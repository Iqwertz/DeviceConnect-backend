import * as express from "express";
import { createServer } from "http";
import * as socketio from "socket.io";

const sockets = new Map<string, SessionData>();
const sessionsStore = new Map<string, SessionEnviroment>();
const app = express();
const http = createServer(app);
const rootSocket = socketio(http);

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

let id: number = 1000;

function getNewId(): string {
  return String(getRandomInt(1000, 9999));
}

export interface ChatData {
  chatId: string;
  chatUser?: number;
  chatMessages: ChatMessage[];
}

export interface ChatMessage {
  userId?: number;
  date?: Date;
  message: string;
  messageId: number;
}

export interface SessionData {
  socket: any;
  chatData?: ChatData;
}

function getRandomInt(min: number, max: number): number {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

app.post("/new", (req, res) => {
  const newId = getNewId();

  const io = socketio(http, {
    path: `/${newId}`,
  });

  const sessionEnviroment: SessionEnviroment = new SessionEnviroment(newId);
  sessionsStore.set(newId, sessionEnviroment);

  io.on("connection", (socket) => {
    socket.join(newId);
    console.log("Connected");
    let chatData: ChatData = {
      chatId: newId,
      chatMessages: [],
    };
    socket.on("chat message", (msg) => {
      const chatMessage: ChatMessage = {
        message: msg,
        messageId: 404,
      };
      chatData.chatMessages.push(chatMessage);
      console.log(newId);

      io.in(newId).emit("chat message", msg);
    });

    socket.on("disconnect", () => {
      console.log("user disconnected");
    });

    io.in(socket.id).emit("chat message", "successfully connected to " + newId);
  });
  const session: SessionData = {
    socket: io,
  };
  sockets.set(newId, session);
  console.log(sockets);
  res.json({ sessionId: newId });
});

http.listen(3000, () => {
  console.log("listening on *:3000");
});
