import { enviroment } from "./enviroment";
import { removeSessionById } from "./index";
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

export interface UserData {
  userName?: string;
  userId: string;
}

export class SessionEnviroment {
  id: string;
  chatData: ChatData;
  userDataArray: Map<string, UserData> = new Map<string, UserData>();
  io: SocketIO.Socket;
  private destroyTimeout;

  constructor(newId: string, newSocket: any) {
    this.id = newId;
    this.io = newSocket;
    this.chatData = {
      chatId: this.id,
      chatMessages: [],
    };
  }

  sendChatMessage(message: string) {
    console.log(message);
    const chatMessage: ChatMessage = {
      message: message,
      messageId: 404,
    };
    this.chatData.chatMessages.push(chatMessage);
    this.io.in(this.id).emit(enviroment.messageIdentifier, message);
  }

  registerUser(uId: string) {
    const userData: UserData = {
      userId: uId,
    };
    console.log(uId);
    this.userDataArray.set(uId, userData);

    for (const msg of this.chatData.chatMessages) {
      this.io.in(uId).emit(enviroment.messageIdentifier, msg.message);
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

  destroy() {
    removeSessionById(this.id);
    console.log("Session removed");
  }
}
