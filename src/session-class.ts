import { enviroment } from "./enviroment";
import { removeSessionById } from "./index";
export interface ChatData {
  chatId: string;
  chatMessages: Map<number, ChatMessage>;
}

export type ContentType = "Document" | "Picture" | "Text";

export interface ChatMessage {
  message: string;
  messageId: number;
  userId: string;
  userName: string;
  contentType: ContentType;
  base64Data: string;
  date?: Date;
}

export interface ReceiveMessageObject {
  message: string;
  base64Data: string;
  contentType: ContentType;
}

export interface SessionInitData {
  userId: string;
  sessionId: string;
  userName: string;
}

export interface UserData {
  userName: string;
  userId: string;
}

export class SessionEnviroment {
  id: string;
  chatData: ChatData;
  userDataArray: Map<string, UserData> = new Map<string, UserData>();
  io: SocketIO.Socket;
  private destroyTimeout;
  private availableAnimalNames: string[] = enviroment.animalNames;
  messageIdCounter: number = 0;
  pictureMessageIds: number[] = [];

  documentIdCounter: number = 0;
  documentMessageIds: number[] = [];

  sessionUserIds: string[] = []; //Used to check if uuid is realy unique

  constructor(newId: string, newSocket: any) {
    this.id = newId;
    this.io = newSocket;
    this.chatData = {
      chatId: this.id,
      chatMessages: new Map<number, ChatMessage>(),
    };
  }

  sendChatMessage(message: ReceiveMessageObject, senderId: string) {
    const chatMessage: ChatMessage = {
      message: message.message,
      messageId: this.messageIdCounter++,
      userId: senderId,
      userName: this.userDataArray.get(senderId).userName,
      base64Data: message.base64Data,
      contentType: message.contentType,
    };
    if (chatMessage.contentType == "Picture") {
      this.pictureMessageIds.push(chatMessage.messageId);
      if (this.pictureMessageIds.length > enviroment.maxPictures) {
        this.deleteChatMessage(this.pictureMessageIds[0]);
        this.pictureMessageIds.shift();
      }
    } else if (chatMessage.contentType == "Document") {
      this.documentMessageIds.push(chatMessage.messageId);
      if (this.documentMessageIds.length > enviroment.maxDocuments) {
        this.deleteChatMessage(this.pictureMessageIds[0]);
        this.documentMessageIds.shift();
      }
    }
    this.chatData.chatMessages.set(chatMessage.messageId, chatMessage);
    this.io.in(this.id).emit(enviroment.messageIdentifier, chatMessage);
  }

  sendServerMessage(message: string, senderId: string, all: boolean) {
    const mId: number = all ? this.messageIdCounter++ : -1;
    const chatMessage: ChatMessage = {
      message: message,
      messageId: mId,
      userId: "SERVER",
      userName: "Server",
      contentType: "Text",
      base64Data: "",
    };

    if (all) {
      this.io.in(this.id).emit(enviroment.messageIdentifier, chatMessage);
      this.chatData.chatMessages.set(chatMessage.messageId, chatMessage);
    } else {
      this.io.in(senderId).emit(enviroment.messageIdentifier, chatMessage);
    }
  }

  deleteChatMessage(mId: number) {
    //This function deletes the message only on the server!
    this.chatData.chatMessages.delete(mId);
  }

  registerUser(uId: string) {
    const uName: string = this.generateUsername();
    const userData: UserData = {
      userId: uId,
      userName: uName,
    };
    this.userDataArray.set(uId, userData);

    const sessionInitData: SessionInitData = {
      userId: uId,
      userName: uName,
      sessionId: this.id,
    };
    this.io.in(uId).emit("SessionIni", sessionInitData);
    this.io.in(this.id).emit("newUser", this.mapToObj(this.userDataArray));
    this.chatData.chatMessages.forEach((value, key) => {
      this.io.in(uId).emit(enviroment.messageIdentifier, value);
    });
    /*
    for (const msg of this.chatData.chatMessages) {
      this.io.in(uId).emit(enviroment.messageIdentifier, msg);
    }*/
    this.sendServerMessage(uName + " joined", uId, true);
    clearTimeout(this.destroyTimeout);

    console.log("User:" + uId + " joined on session " + this.id);
  }

  disconnectUser(uId: string) {
    const userName: string = this.userDataArray.get(uId).userName;
    this.availableAnimalNames.push(userName);
    this.userDataArray.delete(uId);
    console.log(this.userDataArray);
    this.io.in(this.id).emit("newUser", this.mapToObj(this.userDataArray));
    this.sendServerMessage(userName + " disconnected", uId, true);
    this.checkActiveUser();
  }

  private checkActiveUser() {
    if (this.userDataArray.size == 0) {
      this.destroyTimeout = setTimeout(() => {
        this.destroy();
      }, enviroment.destroySessionDelay);
    }
  }

  private generateUsername(): string {
    let generatedName: string = this.availableAnimalNames[
      Math.floor(Math.random() * this.availableAnimalNames.length)
    ];
    this.availableAnimalNames = this.availableAnimalNames.filter(
      (item) => item != generatedName
    );
    return generatedName;
  }

  private getUniqueId(parts: number): string {
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
    let obj = {};

    inputMap.forEach(function (value, key) {
      obj[key] = value;
    });

    return obj;
  }

  destroy() {
    removeSessionById(this.id);
    console.log("Session removed");
  }
}
