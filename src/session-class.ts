import { enviroment } from "./enviroment";
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

export class SessionEnviroment {
  id: string;
  chatData: ChatData;
  io: SocketIO.Socket;

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

  registerUser(UserId: string) {
    for (const msg of this.chatData.chatMessages) {
      this.io.in(UserId).emit(enviroment.messageIdentifier, msg.message);
    }
    console.log("User:" + UserId + " joined on session " + this.id);
  }

  disconnectUser() {}
}
