import * as CryptoJS from 'crypto-js';
import { JSEncrypt } from 'jsencrypt';
import { ChatInstance, ChatMessage, InputNameParams, PendingRequest, Session, UserDisconnectedParams } from './Interfaces';
import MessengerService, { RequestConnectionResponseStatus } from './services/messenger-service';

export class ApplicationEventHandler<T> {
    private _handlers: ((arg: T) => void)[];

    constructor() {
        this._handlers = [];
    }

    add(handler: (arg: T) => void) {
        this._handlers.push(handler);
    }

    remove(handler: (args: T) => void) {
        let index = this._handlers.indexOf(handler);
        if (index !== -1) {
            this._handlers.splice(index, 1);
        }
    }

    invoke(arg: T) {
        this._handlers.forEach(f => {
            f(arg);
        });
    }
}

export interface IStringKeyDictionary<T> {
    Add(key: string, value: T): void;
    ContainsKey(key: string): boolean;
    Count(): number;
    Item(key: string): T;
    ItemOrDefault(key: string): T | undefined;
    Keys(): string[];
    Remove(key: string): T | undefined;
    Values(): T[];
}

export class StringKeyDictionary<T> implements IStringKeyDictionary<T> {
    private items: { [index: string]: T } = {};

    private count: number = 0;

    public ContainsKey(key: string): boolean {
        return this.items.hasOwnProperty(key);
    }

    public Count(): number {
        return this.count;
    }

    public Add(key: string, value: T) {
        if (!this.items.hasOwnProperty(key))
            this.count++;

        this.items[key] = value;
    }

    public Remove(key: string): T | undefined {
        var val = this.ItemOrDefault(key);
        if (val) {
            delete this.items[key];
            this.count--;
        }
        return val;
    }

    public Item(key: string): T {
        return this.items[key];
    }

    public ItemOrDefault(key: string): T | undefined {
        return this.ContainsKey(key) ? this.items[key] : undefined;
    }

    public Keys(): string[] {
        var keySet: string[] = [];

        for (var prop in this.items) {
            if (this.items.hasOwnProperty(prop)) {
                keySet.push(prop);
            }
        }

        return keySet;
    }

    public Values(): T[] {
        var values: T[] = [];

        for (var prop in this.items) {
            if (this.items.hasOwnProperty(prop)) {
                values.push(this.items[prop]);
            }
        }

        return values;
    }
}

class Application {
    private static readonly AES_KeySize: number = 256;
    private static readonly AES_KeyIterations: number = 1000;

    private static readonly RSA_KeySize: string = '2048';
    private _pendentRequests: IStringKeyDictionary<PendingRequest> = new StringKeyDictionary<PendingRequest>();
    private _chats: IStringKeyDictionary<ChatInstance> = new StringKeyDictionary<ChatInstance>();

    public session: Session = { id: '', keys: { publicKey: '', privateKey: '' }, ready: false };

    //Event Handlers
    public onConnected: ApplicationEventHandler<string> = new ApplicationEventHandler<string>();
    public onChatAdded: ApplicationEventHandler<ChatInstance[]> = new ApplicationEventHandler<ChatInstance[]>();
    public onMessage: ApplicationEventHandler<ChatMessage> = new ApplicationEventHandler<ChatMessage>();
    public onReady: ApplicationEventHandler<null> = new ApplicationEventHandler<null>();
    public onUserDisconnected: ApplicationEventHandler<UserDisconnectedParams> = new ApplicationEventHandler<UserDisconnectedParams>();
    public inputName: ApplicationEventHandler<InputNameParams> = new ApplicationEventHandler<InputNameParams>();

    constructor() {
        MessengerService.setOnRequestConnectionHandler((id, publicKey) => {
            if (confirm(`New connection request.\nID: ${id}\nAccept?`)) {
                let request = this.addPendingRequest(id, true);
                let encryptedKey: string | undefined = undefined;
                if (request.encryptionKey) {
                    encryptedKey = this.encryptWithPublicKey(request.encryptionKey, publicKey);
                }

                if (encryptedKey) {
                    MessengerService.acceptConnection(id, encryptedKey);
                } else {
                    MessengerService.rejectConnection(id);
                }
            } else {
                MessengerService.rejectConnection(id);
            }
        });

        MessengerService.setOnRequestConnectionResponseHandler((groupId, userId, status, encryptionKey) => {
            let request = this._pendentRequests.Remove(userId);

            switch (status) {
                case RequestConnectionResponseStatus.Accepted:
                    if (request) {
                        let key: string | undefined = request.encryptionKey || this.decryptWithPrivateKey(encryptionKey);
                        if (key) {
                            this.addChat(groupId, userId, key);
                        }
                    }
                    break;
                case RequestConnectionResponseStatus.Rejected:
                    alert(`Connection refused!\nID: ${userId}`);
                    break;
                case RequestConnectionResponseStatus.Disconnected:
                    alert(`User disconnected.\nID: ${userId}`);
                    break;
                case RequestConnectionResponseStatus.Waiting:
                    this.addPendingRequest(userId);
                    break;
                default:
                    break;
            }
        });

        MessengerService.setOnUserDisconnectedHandler((groupId, userId) => {
            this._pendentRequests.Remove(userId);
            let chat = this._chats.ItemOrDefault(groupId);
            if (chat) {
                let users = chat.group.users.filter(u => u.id === userId);
                if (users.length > 0) {
                    users[0].connected = false;
                    let user = users[0].name || users[0].id;

                    this.onUserDisconnected.invoke({ groupId: groupId, user: users[0] });
                }
            }
        });

        MessengerService.setOnConnectedHandler((id) => {
            this.session.id = id;
            this.onConnected.invoke(id);

            this.generateRSAKeys(id);
        });

        MessengerService.setOnMessageHandler(msg => {
            let chat = this._chats.Item(msg.groupId);
            let message = this.decryptReceivedMessage(msg.message, chat.group.encryptionKey);
            msg.message = message;
            msg.date = new Date();
            chat.state.messages.push(msg);
            this.onMessage.invoke(msg);
        });
    }

    private generateRSAKeys(id: string): void {
        const crypt = new JSEncrypt({
            default_key_size: Application.RSA_KeySize
        });

        crypt.getKey((() => {
            this.session.keys = {
                privateKey: crypt.getPrivateKey(),
                publicKey: crypt.getPublicKey()
            };

            this.session.ready = true;

            this.onReady.invoke(null);
        }).bind(this));
    }

    private encryptWithPublicKey(key: string, publicKey: string): string | undefined {
        const crypt = new JSEncrypt({ default_key_size: Application.RSA_KeySize });
        crypt.setPublicKey(publicKey);
        let encoded = btoa(key);
        return crypt.encrypt(encoded) || undefined;
    }

    private decryptWithPrivateKey(encryptedKey: string): string | undefined {
        const crypt = new JSEncrypt({ default_key_size: Application.RSA_KeySize });
        crypt.setPrivateKey(this.session.keys.privateKey);
        let decrypted = crypt.decrypt(encryptedKey);

        if (decrypted) {
            let key = atob(decrypted);
            return key;
        }

        return undefined;
    }

    private addChat(groupId: string, userId: string, encryptionKey: string): void {
        //let name = prompt(`New connection.\nID: ${userId}\nGive a name to the user:`);

        //let params: InputNameParams = {
        //    text: `Give a name to user '${userId}': (leave it empty to keep the ID)`,
        //    callback: ((name: string) => {
        //        let chat: ChatInstance = {
        //            group: {
        //                id: groupId,
        //                encryptionKey: encryptionKey,
        //                users: [{ id: userId, name: name || userId, connected: true }]
        //            },
        //            state: {
        //                currentMessage: '',
        //                messages: []
        //            },
        //            newMessages: false
        //        };

        //        this._chats.Add(groupId, chat);
        //        this.onChatAdded.invoke(this._chats.Values());
        //    }).bind(this)
        //};

        //this.inputName.invoke(params);

        let name = prompt(`New connection.\nID: ${userId}\nGive a name to the user:`);

        let chat: ChatInstance = {
            group: {
                id: groupId,
                encryptionKey: encryptionKey,
                users: [{ id: userId, name: name || userId, connected: true }]
            },
            state: {
                currentMessage: '',
                messages: []
            },
            newMessages: false
        };

        this._chats.Add(groupId, chat);
        this.onChatAdded.invoke(this._chats.Values());
    }

    private addPendingRequest(userId: string, generateKey: boolean = false): PendingRequest {
        let key = generateKey ? CryptoJS.lib.WordArray.random(128 / 8).toString() : undefined;
        let request = {
            userId: userId,
            encryptionKey: key
        };

        this._pendentRequests.Add(userId, request);

        return request;
    }

    getChats(): ChatInstance[] {
        return this._chats.Values();
    }

    getChat(id: string): ChatInstance | undefined {
        return this._chats.ItemOrDefault(id);
    }

    requestConnection(id: string): void {
        MessengerService.requestConnection(id, this.session.keys.publicKey);
    }

    encryptAndSendMessage(groupId: string, message: string, encryptionKey: string) {
        let salt = CryptoJS.lib.WordArray.random(128 / 8);
        let iv = CryptoJS.lib.WordArray.random(128 / 8);

        let key = CryptoJS.PBKDF2(encryptionKey, salt, {
            keySize: Application.AES_KeySize / 32,
            iterations: Application.AES_KeyIterations
        });

        let encryptedMsg = CryptoJS.AES.encrypt(message, key, {
            iv: iv,
            padding: CryptoJS.pad.Pkcs7,
            mode: CryptoJS.mode.CBC
        });

        let msgStr = salt.toString() + iv.toString() + encryptedMsg.toString();
        MessengerService.sendMessage(groupId, msgStr);
    }

    decryptReceivedMessage(message: string, encryptionKey: string): string {
        let salt = CryptoJS.enc.Hex.parse(message.substr(0, 32));
        let iv = CryptoJS.enc.Hex.parse(message.substr(32, 32));
        let encrypted = message.substring(64);

        let key = CryptoJS.PBKDF2(encryptionKey, salt, {
            keySize: Application.AES_KeySize / 32,
            iterations: Application.AES_KeyIterations
        });

        let decryptedMsg = CryptoJS.AES.decrypt(encrypted, key, {
            iv: iv,
            padding: CryptoJS.pad.Pkcs7,
            mode: CryptoJS.mode.CBC
        });

        return decryptedMsg.toString(CryptoJS.enc.Utf8);
    }
}

const App = new Application();

export default App;