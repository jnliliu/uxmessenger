import { HubConnection, HubConnectionBuilder, HttpTransportType } from '@aspnet/signalr';
import { ChatMessage } from '../Interfaces';

export enum RequestConnectionResponseStatus {
    Disconnected = -1,
    Waiting = 0,
    Accepted = 1,
    Rejected = 2
}

export class MessengerMethods {
    public static readonly Send: string = 'Send';
    public static readonly RequestConnection: string = 'RequestConnection';
    public static readonly AcceptConnection: string = 'AcceptConnection';
    public static readonly RejectConnection: string = 'RejectConnection';
    public static readonly OnConnected: string = 'connected';
    public static readonly OnRequestConnection: string = 'requestConnection';
    public static readonly OnMessage: string = 'message';
    public static readonly OnUserDisconnected: string = 'userDisconnected';
    public static readonly OnRequestConnectionResponse: string = 'requestConnectionResponse';
}

class MessengerService {
    private _connection: HubConnection;

    constructor() {
        const url: string = `${document.location.protocol}//${document.location.host}/messenger`;

        this._connection = new HubConnectionBuilder()
            .withUrl(url, HttpTransportType.WebSockets)
            .build();

        this._connection.start().catch(err => console.error(err, 'red'));
    }

    sendMessage(groupId: string, message: string) {
        this._connection.invoke(MessengerMethods.Send, groupId, message);
    }

    requestConnection(id: string, encryptionKey: string) {
        this._connection.invoke(MessengerMethods.RequestConnection, id, encryptionKey);
    }

    acceptConnection(id: string, encryptionKey: string) {
        this._connection.invoke(MessengerMethods.AcceptConnection, id, encryptionKey);
    }

    rejectConnection(id: string) {
        this._connection.invoke(MessengerMethods.RejectConnection, id);
    }

    setOnConnectedHandler(handler: (id: string) => void) {
        this.setHandler(MessengerMethods.OnConnected, handler);
    }

    setOnRequestConnectionHandler(handler: (id: string, publicKey: string) => void) {
        this.setHandler(MessengerMethods.OnRequestConnection, handler);
    }

    setOnRequestConnectionResponseHandler(handler: (groupName: string, id: string, status: RequestConnectionResponseStatus, encryptionKey: string) => void) {
        this.setHandler(MessengerMethods.OnRequestConnectionResponse, handler);
    }

    setOnMessageHandler(handler: (msg: ChatMessage) => void) {
        this.setHandler(MessengerMethods.OnMessage, handler);
    }

    setOnUserDisconnectedHandler(handler: (groupId: string, userId: string) => void) {
        this.setHandler(MessengerMethods.OnUserDisconnected, handler);
    }

    setHandler(methodName: string, handler: (...args: any[]) => void) {
        this._connection.on(methodName, handler);
    }
}

const Messenger = new MessengerService();

export default Messenger;