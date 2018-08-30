import * as moment from 'moment';
import * as React from 'react';
import { RouteComponentProps } from 'react-router';
import { Link } from 'react-router-dom';
import App from '../App';
import { ChatInstance, ChatMessage, ChatState, UserDisconnectedParams, ChatResponseParams, ChatAddedParams } from '../Interfaces';
import MessengerService, { RequestConnectionResponseStatus } from '../services/messenger-service';

export class Chat extends React.Component<RouteComponentProps<{ id: string; }>, ChatState> {
    private chat?: ChatInstance;
    private messageElement: HTMLInputElement | null | undefined;
    private panelElement: HTMLDivElement | null | undefined;

    constructor(props: RouteComponentProps<{ id: string; }> | undefined) {
        super(props)

        if (!props) throw Error('User not found');

        const chat = App.getChat(this.props.match.params.id);

        this.handlePanelRef = this.handlePanelRef.bind(this);
        this.handleMessageRef = this.handleMessageRef.bind(this);
        this.handleMessageChange = this.handleMessageChange.bind(this);
        this.onSubmit = this.onSubmit.bind(this);

        if (!chat) {
            this.state = {
                waitingResponse: true,
                currentMessage: '',
                messages: []
            };

            this.appReadyHandler = this.appReadyHandler.bind(this);
            this.chatAddedHandler = this.chatAddedHandler.bind(this);
            this.chatResponseHandler = this.chatResponseHandler.bind(this);

            App.onChatRequestResponse.add(this.chatResponseHandler);
            App.onChatAdded.add(this.chatAddedHandler);
            App.onReady.add(this.appReadyHandler);
        }
        else {
            chat.newMessages = false;
            this.initChat(chat);
        }
    }

    private initChat(chat: ChatInstance) {
        this.messageReceivedHandler = this.messageReceivedHandler.bind(this);
        this.userDisconnectedHandler = this.userDisconnectedHandler.bind(this);

        this.chat = chat;
        this.state = this.chat.state;
        App.onMessage.add(this.messageReceivedHandler);
        App.onUserDisconnected.add(this.userDisconnectedHandler);
    }

    private appReadyHandler() {
        App.requestConnection(this.props.match.params.id);
    }

    private chatAddedHandler(args: ChatAddedParams) {
        if (args.userId === this.props.match.params.id) {
            const chat = App.getChat(args.groupId);

            if (chat) {
                this.initChat(chat);
                this.props.history.push('/c/' + args.groupId);
            } else {
                this.props.history.push('/');
            }
        }
    }

    private chatResponseHandler(args: ChatResponseParams) {
        if (args.userId === this.props.match.params.id) {
            switch (args.status) {
                case RequestConnectionResponseStatus.Waiting:
                    this.setState({ waitingResponse: true });
                    break;
                case RequestConnectionResponseStatus.Disconnected:
                case RequestConnectionResponseStatus.Rejected:
                    this.props.history.push('/');
                    break;
                default:
                    break;
            }
        }
    }

    private messageReceivedHandler(message: ChatMessage) {
        if (this.chat && message.groupId === this.chat.group.id) {
            this.forceUpdate(() => {
                this.scrollDown(this);
            });
        }
    }

    private userDisconnectedHandler(args: UserDisconnectedParams) {
        if (this.chat && args.groupId === this.chat.group.id) {
            this.forceUpdate(() => {
                this.scrollDown(this);
            });
        }
    }

    public componentWillUnmount() {
        App.onMessage.remove(this.messageReceivedHandler);
        App.onUserDisconnected.remove(this.userDisconnectedHandler);
        App.onChatRequestResponse.remove(this.chatResponseHandler);
        App.onReady.remove(this.appReadyHandler);
        App.onChatAdded.remove(this.chatAddedHandler);
    }

    public render() {
        if (!App.session.ready)
            return <div />;

        if (this.state.waitingResponse)
            return <div className='block-ui-info'>
                <div className='ui-info-msg'>Waiting for user response...<div className='loader'></div></div>
            </div>;

        let msgContents = this.state.messages && this.getMessagesList(this.state.messages);

        return this.state && <div className='panel panel-default msg-panel'>
            <div className='panel-heading'>
                <Link to='/' style={{ verticalAlign: 'middle' }}>
                    <span className='glyphicon glyphicon-circle-arrow-left btn-lg' aria-hidden='true' style={{ color: '#fff', padding: '0 20px 0 0' }}></span>
                </Link>
                {this.chat && this.chat.group.users.map(u => <a href='javascript:void(0)' style={{ verticalAlign: 'text-bottom' }}>
                    <span className='badge'>{u.name} <span className={`user-status ${u.connected ? 'online' : 'offline'}`}></span></span>
                </a>)}
            </div>
            <div className='panel-body'>
                {msgContents}
            </div>
            <div className='panel-footer'>
                <form onSubmit={this.onSubmit} autoComplete='off'>
                    <div className='msg-input'>
                        <input type='text' value={this.state.currentMessage} onChange={this.handleMessageChange} className='form-control'
                            id='messageElement' placeholder='Type a message...' ref={this.handleMessageRef} />
                        <button className="msg-send-btn" type='submit'><i className="glyphicon glyphicon-send" aria-hidden="true"></i></button>
                    </div>
                </form>
            </div>
        </div>;
    }

    public componentDidMount() {
        this.scrollDown(this);
    }

    private getMessagesList(messages: ChatMessage[]) {
        return <div id='messageList' ref={this.handlePanelRef}>
            {messages.map(m => {
                let classNames = 'chat-msg ' + (m.senderId === App.session.id ? 'outgoing' : 'incomming');
                //let classNames = 'chat-msg ' + (m.id % 2 === 0 ? 'outgoing' : 'incomming');
                return <div key={m.id} className={classNames}>
                    <div className='msg-content'>
                        <p>{m.message}</p>
                        <span className='date-time'>{moment(m.date).format('HH:mm')}</span>
                    </div>
                </div>;
            })}
        </div>;
    }

    private handlePanelRef(div: HTMLDivElement | null) {
        this.panelElement = div;
    }

    private handleMessageRef(input: HTMLInputElement | null) {
        this.messageElement = input;
    }

    private handleMessageChange(event: any) {
        this.setState({
            currentMessage: event.target.value
        });
    }

    private onSubmit(event: any) {
        event.preventDefault();

        let currentMessage = this.state.currentMessage;
        if (currentMessage.length === 0) {
            return;
        }

        if (this.chat) {
            App.encryptAndSendMessage(this.chat.group.id, currentMessage, this.chat.group.encryptionKey);
            this.setState({ currentMessage: '' });
            this.focusField(this);
        }
    }

    private focusField(chat: Chat) {
        if (chat.messageElement) {
            chat.messageElement.value = '';
            chat.messageElement.focus();
        }
    }

    private scrollDown(that: Chat) {
        let div = that.panelElement;
        if (div) div.scrollTo({ top: div.scrollHeight + div.offsetTop });
    }
}