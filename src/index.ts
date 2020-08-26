import { SessionEnviroment } from "./session-class";
import * as express from "express";
import { createServer } from "http";
import * as socketio from "socket.io";
import { enviroment } from "./enviroment";

const sessionsStore: Map<string, SessionEnviroment> = new Map<
  string,
  SessionEnviroment
>();
var cors = require("cors");
const app = express();
let http;
const whitelist = ["http://localhost:4200", "https://iqwertz.github.io"];
const corsOptions = {
  credentials: true, // This is important.
  origin: (origin, callback) => {
    console.log(origin);
    if (whitelist.includes(origin)) return callback(null, true);
    console.log("Cors Error");
    callback(new Error("Not allowed by CORS"));
  },
};

http = createServer(app);

app.use(cors(corsOptions));
/*app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});*/

//////this function gets called from the sessionEnviroment class to remove itself from the store / I dont think this is the cleanest way....
export function removeSessionById(id: string) {
  sessionsStore.delete(id);
}

function getNewSessionId(digits: number) {
  let generatedId: string = getRandomId(4, true, true, false);
  while (sessionsStore.has(generatedId)) {
    generatedId = getRandomId(4, true, true, false);
  }

  return generatedId;
}

app.post("/new", (req, res) => {
  console.log(req.headers.origin);
  res.header("Access-Control-Allow-Origin", [req.headers.origin]);

  const newId = getNewSessionId(4);

  const io = socketio(http, {
    path: `/${newId}`,
    origins: req.headers.origin,
  });

  const sessionEnviroment: SessionEnviroment = new SessionEnviroment(newId, io);
  sessionsStore.set(newId, sessionEnviroment);
  console.log("New Session generated");

  io.on("connection", (socket) => {
    socket.join(newId);
    console.log("Connected");

    sessionEnviroment.registerUser(socket.id);

    sessionEnviroment.sendServerMessage(
      "successfully connected to " + newId,
      socket.id,
      false
    );

    socket.on(enviroment.messageIdentifier, (msg) => {
      sessionEnviroment.sendChatMessage(msg, socket.id);
    });

    socket.on("disconnect", () => {
      sessionEnviroment.disconnectUser(socket.id);
      console.log("user disconnected");
    });
  });
  res.json({ sessionId: newId });
});

app.get("/session/:id", (req, res) => {
  if (sessionsStore.has(req.params.id)) {
    console.log("200");
    res.json();
  } else {
    res.sendStatus(404);
  }
});

http.listen(enviroment.port, () => {
  console.log("listening on *:" + enviroment.port);
});

function getRandomId(
  digits: number,
  numbers: boolean,
  capitalLetter: boolean,
  letter: boolean
): string {
  const nChar = "0123456789";
  const cChar = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lChar = "abcdefghijklmnopqrstuvwxyz";

  var characters = numbers ? nChar : "";
  characters += capitalLetter ? cChar : "";
  characters += letter ? lChar : "";

  var result = "";
  var charactersLength = characters.length;
  for (let i: number = 0; i < digits; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}
