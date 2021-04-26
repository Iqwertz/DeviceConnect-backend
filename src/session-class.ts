////////////////////////////////////////
/*
Session Class:
Manages sessions and contains session data
Every new Session is an instance of this class

Interfaces: 
  ChatMessage
  ChatData
  ReceiveMessageObject
  SessionIniData
  UserData
functions:
  sendChatMessage()
  sendServerMessage()
  deleteChatMessage()
  registerUser()
  checkActiveUser()
  destroy()
*/
////////////////////////////////////////

import { enviroment } from "./enviroment";
import { removeSessionById } from "./index";

export interface ChatData {
  //stores the chatdata
  chatId: string; //session id
  chatMessages: Map<number, ChatMessage>; //map which maps the message id to the message
}

export type ContentType = "Document" | "Picture" | "Text";

export interface ChatMessage {
  //chat Message object containig data for one message
  message: string; //the message
  messageId: number; //the message Id / nis unique
  userId: string; //the sender Id
  userName: string; //the sender Name
  contentType: ContentType; //the content of the message
  base64Data: string; //base64data when message is a file or document
  chunkedBase64Data?: Chunk[];
  date?: Date; //Date currently not implemented
}

export interface ReceiveMessageObject {
  //Object containing the data when receiving a message
  message: string; //the message
  base64Data: string; //base64data when message is a file or document
  contentType: ContentType; //the type of content
}

export interface SessionInitData {
  //Object that gets sent to the user when joining a Session
  userId: string; //the Id of the User
  sessionId: string; //the Session Id
  userName: string; //The username
}

export interface UserData {
  //Object containing the data of a user
  userName: string;
  userId: string;
}

export type ChunkType = "start" | "middle" | "end";

export interface Chunk {
  //Object containing chunk data
  chunkType: ChunkType;
  chunkData: string;
  chunkID: string;
  chunkIndex: number;
  parentMessageId: number;
  senderId: string;
}

export class SessionEnviroment {
  id: string; //session id
  chatData: ChatData;
  userDataArray: Map<string, UserData> = new Map<string, UserData>(); //Map Containing the data of all users in the session
  io: SocketIO.Socket;
  private destroyTimeout;
  private availableAnimalNames: string[] = enviroment.animalNames; // all available animal names in current session / needed to avoid user with same name
  messageIdCounter: number = 0; //Counter counting messages / used to create message Ids / never is decreased to maintain a unique Id
  pictureMessageIds: number[] = []; //Array holding Ids of all messages with pictures

  documentMessageIds: number[] = []; //Array holding Ids of all messages with dopcuments

  sessionUserIds: string[] = []; //Used to check if uuid is really unique

  receivingMessages: Map<string, ChatMessage> = new Map<string, ChatMessage>();

  chunkQueue: Chunk[] = [];

  constructor(newId: string, newSocket: any) {
    this.id = newId;
    this.io = newSocket;
    this.chatData = {
      chatId: this.id,
      chatMessages: new Map<number, ChatMessage>(),
    };
  }

  sendChatMessage(message: ReceiveMessageObject, senderId: string) {
    //sends a Chat Message
    const chatMessage: ChatMessage = {
      //creates new message from params
      message: message.message,
      messageId: this.messageIdCounter++,
      userId: senderId,
      userName: this.userDataArray.get(senderId).userName,
      base64Data: message.base64Data,
      chunkedBase64Data: [],
      contentType: message.contentType,
    };
    if (chatMessage.contentType != "Text") {
      this.receivingMessages.set(chatMessage.base64Data, chatMessage);
      this.io.in(senderId).emit("chunkResponse", { res: "next" });

      if (chatMessage.contentType == "Picture") {
        //If message is a picture add it to picture array
        this.pictureMessageIds.push(chatMessage.messageId);
        if (this.pictureMessageIds.length > enviroment.maxPictures) {
          //When to much pictures are saved delete the last one
          this.deleteChatMessage(this.pictureMessageIds[0]);
          this.pictureMessageIds.shift();
        }
      } else if (chatMessage.contentType == "Document") {
        //If message is a picture add it to picture array
        this.documentMessageIds.push(chatMessage.messageId);
        if (this.documentMessageIds.length > enviroment.maxDocuments) {
          //When to much documents are saved delete the last one
          this.deleteChatMessage(this.pictureMessageIds[0]);
          this.documentMessageIds.shift();
        }
      }

      //transform Message for loading
    }
    this.chatData.chatMessages.set(chatMessage.messageId, chatMessage); //sace chat Message on server
    this.io.in(this.id).emit(enviroment.messageIdentifier, chatMessage); //emit message to everyone in session
  }

  receiveChunk(chunk: Chunk) {
    const cId = chunk.chunkID;
    let msg = this.receivingMessages.get(cId);
    if (chunk.chunkType == "start") {
      msg.base64Data = chunk.chunkData;

      msg.chunkedBase64Data.push(chunk);
      this.receivingMessages.set(cId, msg);
    } else if (chunk.chunkType == "middle") {
      msg.base64Data += chunk.chunkData;
      msg.chunkedBase64Data.push(chunk);
      this.receivingMessages.set(cId, msg);
    } else if (chunk.chunkType == "end") {
      console.log("image upload finished");
      msg.base64Data += chunk.chunkData;
      msg.chunkedBase64Data.push(chunk);
      this.chatData.chatMessages.set(msg.messageId, msg);
      this.receivingMessages.delete(cId);
      this.sendFileMessage(msg);
    }

    this.io.in(chunk.senderId).emit("chunkResponse", { res: "next" });
  }

  sendFileMessage(msg: ChatMessage, user?: string) {
    if (user == undefined) {
      user = this.id;
    }
    /* let chunkedData = this.chunkString(
      msg.base64Data,
      enviroment.chunkSize,
      msg.messageId.toString(),
      msg.userId
    );
    this.chunkQueue = this.chunkQueue.concat(chunkedData);*/
    msg.chunkedBase64Data[0].parentMessageId = msg.messageId;
    this.io.in(user).emit("chunkData", msg.chunkedBase64Data[0]);
    //this.chunkQueue.shift();
  }

  chunkResponse(res) {
    console.log(res);
    if (res.res == "next") {
      //if (this.chunkQueue.length >= 1) {
      //msg.chunkedBase64Data[0].parentMessageId=msg.messageId;
      let chunk = this.chatData.chatMessages.get(res.parentMessageId)
        .chunkedBase64Data[res.lastChunkIndex + 1];
      chunk.parentMessageId = res.parentMessageId;
      this.io.in(res.senderId).emit("chunkData", chunk);
      //this.chunkQueue.shift();
    }
    //}
  }

  private chunkString(
    str: string,
    len: number,
    messageId: string,
    senderId: string
  ): Chunk[] {
    //splits string into chunks
    const size = Math.ceil(str.length / len);
    const r: Chunk[] = Array(size);
    let offset = 0;

    for (let i = 0; i < size; i++) {
      r[i] = {
        chunkData: str.substr(offset, len),
        chunkType: "middle",
        chunkID: messageId,
        parentMessageId: Number(messageId),
        senderId: senderId,
        chunkIndex: i,
      };
      offset += len;
    }

    if (r.length == 1) {
      r.push({
        chunkData: "",
        chunkID: messageId,
        parentMessageId: Number(messageId),
        chunkType: "end",
        senderId: senderId,
        chunkIndex: 1,
      });
    }

    r[0].chunkType = "start";
    r[r.length - 1].chunkType = "end";

    return r;
  }

  sendServerMessage(message: string, senderId: string, all: boolean) {
    //sends a Server message / if all is true it gets sent to everyone in the session
    const mId: number = all ? this.messageIdCounter++ : -1; //only increase counter when sent to everyone
    const chatMessage: ChatMessage = {
      //create chatmessage object
      message: message,
      messageId: mId,
      userId: "SERVER",
      userName: "Server",
      contentType: "Text",
      base64Data: "",
    };

    if (all) {
      //when all save message and emit to everyone in session, else only to the sender
      this.io.in(this.id).emit(enviroment.messageIdentifier, chatMessage);
      this.chatData.chatMessages.set(chatMessage.messageId, chatMessage);
    } else {
      this.io.in(senderId).emit(enviroment.messageIdentifier, chatMessage);
    }
  }

  deleteChatMessage(mId: number) {
    //deletes a chat message by Id
    //This function deletes the message only on the server!
    this.chatData.chatMessages.delete(mId);
  }

  registerUser(uId: string) {
    //registers a new User in the session
    const uName: string = this.generateUsername(); //generates a username
    const userData: UserData = {
      //creates userdata
      userId: uId,
      userName: uName,
    };
    this.userDataArray.set(uId, userData);

    const sessionInitData: SessionInitData = {
      //create session ini data
      userId: uId,
      userName: uName,
      sessionId: this.id,
    };
    this.io.in(uId).emit("SessionIni", sessionInitData); //sent session ini data back to the user
    this.io.in(this.id).emit("newUser", this.mapToObj(this.userDataArray)); //send new user notification to everyone (to update userdata on client side)
    this.chatData.chatMessages.forEach((value, key) => {
      //send every previously send message to the new user
      if (value.contentType != "Text") {
        let msg = Object.assign({}, value);
        msg.base64Data = "";
        this.io.in(uId).emit(enviroment.messageIdentifier, msg);
        this.sendFileMessage(value, uId);
      } else {
        this.io.in(uId).emit(enviroment.messageIdentifier, value);
      }
    });
    this.sendServerMessage(uName + " joined", uId, true); //send servermessage to inform everyone that a new user joined
    clearTimeout(this.destroyTimeout); //clears timeout to stop destroying server

    console.log("User:" + uId + " joined on session " + this.id);
  }

  disconnectUser(uId: string) {
    //Disconnect a user from the server and deletes its data
    const userName: string = this.userDataArray.get(uId).userName;
    this.availableAnimalNames.push(userName); //adds username to the available names
    this.userDataArray.delete(uId); //deletes user from user Array
    console.log(this.userDataArray);
    this.io.in(this.id).emit("newUser", this.mapToObj(this.userDataArray)); //send new user notification to everyone (to update userdata on client side)
    this.sendServerMessage(userName + " disconnected", uId, true); //send disconnect note to everyone on the server
    this.checkActiveUser(); //ceheck for active users left
  }

  private checkActiveUser() {
    //check fo active users and start destroy timeout when no one is left
    if (this.userDataArray.size == 0) {
      this.destroyTimeout = setTimeout(() => {
        this.destroy();
      }, enviroment.destroySessionDelay);
    }
  }

  private generateUsername(): string {
    //generates a random username based on the availabel user names on the server and removes the generated name from the available usernames
    let generatedName: string = this.availableAnimalNames[
      Math.floor(Math.random() * this.availableAnimalNames.length)
    ];
    this.availableAnimalNames = this.availableAnimalNames.filter(
      (item) => item != generatedName
    );
    return generatedName;
  }

  private getUniqueId(parts: number): string {
    //creates a uuid
    const stringArr = [];
    for (let i = 0; i < parts; i++) {
      const S4 = (((1 + Math.random()) * 0x10000) | 0)
        .toString(16)
        .substring(1);
      stringArr.push(S4);
    }
    return stringArr.join("-");
  }

  private mapToObj(inputMap: Map<any, any>) {
    //converts a map to an object
    let obj = {};

    inputMap.forEach(function (value, key) {
      obj[key] = value;
    });

    return obj;
  }

  destroy() {
    //destroys session
    removeSessionById(this.id);
    console.log("Session removed");
  }
}
