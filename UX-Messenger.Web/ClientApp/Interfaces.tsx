import { WordArray } from "crypto-js";

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