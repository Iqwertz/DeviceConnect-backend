//Error
/*
as been blocked by CORS policy: The value of the 'Access-Control-Allow-Origin' header in the response must not be the wildcard '*'
when the request's credentials mode is 'include'. The credentials mode of requests initiated by the XMLHttpRequest is controlled by
 the withCredentials attribute.
*/
import { SessionEnviroment } from "./session-class";
import * as express from "express";
import * as socketio from "socket.io";
import { enviroment } from "./enviroment";

const sessionsStore: Map<string, SessionEnviroment> = new Map<string, SessionEnviroment>();
var cors = require("cors");
const app = express();
app.use(require("express-status-monitor")());
let http;

/////PArams for cors errors, This is mostly a mess I am going to clean it up when the server is running and working
/* const whitelist = ["http://localhost:4200", "https://iqwertz.github.io", "http://transfertube.000webhostapp.com"];
const corsOptions = {
  credentials: true, // This is important.
  origin: (origin, callback) => {
    console.log(origin);
    if (whitelist.includes(origin)) return callback(null, true);
    callback(new Error("Not allowed by CORS"));
  },
}; */

http = require("http").Server(app);

const corsOptions = {
  origin: true, //Fuck cors
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
/*app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});*/

//////this function gets called from the sessionEnviroment class to remove itself from the store / I dont think this is the cleanest way....
export function removeSessionById(id: string) {
  sessionsStore.delete(id);
}

function getNewSessionId(digits: number) {
  //creates a new session id
  let generatedId: string = getRandomId(4, true, true, false);
  while (sessionsStore.has(generatedId)) {
    generatedId = getRandomId(4, true, true, false);
  }

  return generatedId;
}

app.post(enviroment.basePath + "/new", (req, res) => {
  //creates a new session

  const newId = getNewSessionId(4); //generate new Id

  let io = socketio(server, {
    //create socket
    path: enviroment.basePath + `/${newId}`,
  });

  const sessionEnviroment: SessionEnviroment = new SessionEnviroment(newId, io); //create new SessionEnviroment
  sessionsStore.set(newId, sessionEnviroment); //register new Session in the session map
  console.log("New Session generated");

  io.on("connection", (socket) => {
    //when a user connects
    socket.join(newId); //join socket in session
    console.log("Connected");

    sessionEnviroment.registerUser(socket.id); //register user in session

    sessionEnviroment.sendServerMessage(
      //send to user success message
      "successfully connected to " + newId,
      socket.id,
      false
    );

    socket.on(enviroment.messageIdentifier, (msg) => {
      //when a new message arrives call sendChatMessage
      sessionEnviroment.sendChatMessage(msg, socket.id);
    });

    socket.on("disconnect", () => {
      //when user disconnects call disconnectUser
      sessionEnviroment.disconnectUser(socket.id);
      console.log("user disconnected");
    });
  });
  res.json({ sessionId: newId }); //send the session is as respons back
});

app.get(enviroment.basePath + "/session/:id", (req, res) => {
  //checks if session exists in session store and returns a html statu
  if (sessionsStore.has(req.params.id)) {
    console.log("200");
    res.json();
  } else {
    res.sendStatus(404);
  }
});

let server = http.listen(process.env.PORT || enviroment.port, () => {
  //listen to port
  console.log("listening on *:" + enviroment.port);
});

function getRandomId(digits: number, numbers: boolean, capitalLetter: boolean, letter: boolean): string {
  //universal function to generate random id
  const nChar = "123456789"; //All: const nChar = "0123456789"; /Removed easy mistaken Id letter
  const cChar = "ABCDEFGHJKLMNPQRSTUVWXYZ"; //All const cChar = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";  / Removed easy mistaken Id letter
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
