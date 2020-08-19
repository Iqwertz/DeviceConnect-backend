import { enviroment } from "./enviroment";
import { removeSessionById } from "./index";
export interface ChatData {
  chatId: string;
  chatUser?: number;
  chatMessages: ChatMessage[];
}

export interface ChatMessage {
  message: string;
  messageId: number;
  userId: string;
  date?: Date;
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

  constructor(newId: string, newSocket: any) {
    this.id = newId;
    this.io = newSocket;
    this.chatData = {
      chatId: this.id,
      chatMessages: [],
    };
  }

  sendChatMessage(message: string, senderId: string) {
    const chatMessage: ChatMessage = {
      message: message,
      messageId: this.messageIdCounter++,
      userId: senderId,
    };
    this.chatData.chatMessages.push(chatMessage);
    this.io.in(this.id).emit(enviroment.messageIdentifier, chatMessage);
  }

  sendServerMessage(message: string, senderId: string) {
    const chatMessage: ChatMessage = {
      message: message,
      messageId: this.messageIdCounter++,
      userId: "SERVER",
    };
    this.io.in(senderId).emit(enviroment.messageIdentifier, chatMessage);
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
    for (const msg of this.chatData.chatMessages) {
      this.io.in(uId).emit(enviroment.messageIdentifier, msg);
    }

    clearTimeout(this.destroyTimeout);

    console.log("User:" + uId + " joined on session " + this.id);
  }

  disconnectUser(uId: string) {
    this.userDataArray.delete(uId);
    console.log(this.userDataArray);
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

  destroy() {
    removeSessionById(this.id);
    console.log("Session removed");
  }
}
