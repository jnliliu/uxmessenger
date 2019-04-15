import * as CryptoJS from 'crypto-js';
import { JSEncrypt } from 'jsencrypt';
import { ChatInstance, ChatMessage, InputNameParams, PendingRequest, Session, UserDisconnectedParams, ChatResponseParams, ChatAddedParams } from './Interfaces';
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
    private static readonly AES_KeySize: number = 512;
    private static readonly AES_KeyIterations: number = 1000;
    private static readonly RSA_KeySize: string = '1024';

    private _pendentRequests: IStringKeyDictionary<PendingRequest> = new StringKeyDictionary<PendingRequest>();
    private _chats: IStringKeyDictionary<ChatInstance> = new StringKeyDictionary<ChatInstance>();

    public session: Session = { id: '', keys: { publicKey: '', privateKey: '' }, ready: false };

    //Event Handlers
    public onConnected: ApplicationEventHandler<string> = new ApplicationEventHandler<string>();
    public onChatAdded: ApplicationEventHandler<ChatAddedParams> = new ApplicationEventHandler<ChatAddedParams>();
    public onMessage: ApplicationEventHandler<ChatMessage> = new ApplicationEventHandler<ChatMessage>();
    public onReady: ApplicationEventHandler<null> = new ApplicationEventHandler<null>();
    public onUserDisconnected: ApplicationEventHandler<UserDisconnectedParams> = new ApplicationEventHandler<UserDisconnectedParams>();
    public onChatRequestResponse: ApplicationEventHandler<ChatResponseParams> = new ApplicationEventHandler<ChatResponseParams>();
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

            this.onChatRequestResponse.invoke({
                groupId: groupId,
                userId: userId,
                status: status
            });
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
                waitingResponse: false,
                currentMessage: '',
                messages: []
            },
            newMessages: false
        };

        this._chats.Add(groupId, chat);
        this.onChatAdded.invoke({ chats: this._chats.Values(), groupId: groupId, userId: userId });
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

    isMobile(): boolean {
        var check = false;

        (function (a) {
            if (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|ipad|playbook|silk/i.test(a) || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0, 4))) {
                check = true;
            }
        })(navigator.userAgent || navigator.vendor || window['opera']);
        return check;
    }
}

const App = new Application();

export default App;