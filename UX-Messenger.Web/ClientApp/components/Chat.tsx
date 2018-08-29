import * as moment from 'moment';
import * as React from 'react';
import { RouteComponentProps } from 'react-router';
import { Link } from 'react-router-dom';
import App from '../App';
import { ChatInstance, ChatMessage, ChatState, UserDisconnectedParams } from '../Interfaces';
import MessengerService from '../services/messenger-service';

export class Chat extends React.Component<RouteComponentProps<{ id: string; }>, ChatState> {
    private chat?: ChatInstance;
    private messageElement: HTMLInputElement | null | undefined;
    private panelElement: HTMLDivElement | null | undefined;

    constructor(props: RouteComponentProps<{ id: string; }> | undefined) {
        super(props)

        if (!props) throw Error('User not found');

        let chat = App.getChat(this.props.match.params.id);

        if (!chat) {
            this.props.history.push('/');
        }
        else {
            chat.newMessages = false;
            this.chat = chat;
            this.state = this.chat.state;
            let that = this;

            this.handlePanelRef = this.handlePanelRef.bind(this);
            this.handleMessageRef = this.handleMessageRef.bind(this);
            this.handleMessageChange = this.handleMessageChange.bind(this);
            this.onSubmit = this.onSubmit.bind(this);
            this.messageReceivedHandler = this.messageReceivedHandler.bind(this);
            this.userDisconnectedHandler = this.userDisconnectedHandler.bind(this);

            App.onMessage.add(this.messageReceivedHandler);
            App.onUserDisconnected.add(this.userDisconnectedHandler);
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
    }

    public render() {
        if (!this.state) return <div />;

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