import { WordArray } from "crypto-js";
import { RequestConnectionResponseStatus } from "./services/messenger-service";

export interface RSAKey {
    publicKey: string;
    privateKey: string;
}

export interface Session {
    id: string;
    keys: RSAKey;
    ready: boolean;
}

export interface User {
    id: string;
    name: string;
    connected: boolean;
    publicKey?: string;
}

export interface PendingRequest {
    userId: string;
    encryptionKey?: string;
}

export interface ChatMessage {
    id: string,
    date: Date;
    message: string;
    senderId: string;
    groupId: string;
}

export interface Group {
    id: string;
    encryptionKey: string;
    users: User[];
}

export interface ChatState {
    waitingResponse: boolean;
    messages: ChatMessage[];
    currentMessage: string;
}

export interface ChatInstance {
    group: Group;
    newMessages: boolean;
    state: ChatState;
}

export interface UserDisconnectedParams {
    groupId: string;
    user: User;
}

export interface InputNameParams {
    text: string;
    callback: (name: string | null) => void
}

export interface ChatAddedParams {
    chats: ChatInstance[];
    groupId: string;
    userId: string;
}

export interface ChatResponseParams {
    groupId?: string;
    userId: string;
    status: RequestConnectionResponseStatus;
}