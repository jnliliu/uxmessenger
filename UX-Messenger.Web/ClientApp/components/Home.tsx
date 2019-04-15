import * as copy from 'copy-to-clipboard';
import * as React from 'react';
import { RouteComponentProps } from 'react-router';
import { Link } from 'react-router-dom';
import App from '../App';
import { ChatInstance, ChatMessage, ChatAddedParams } from '../Interfaces';
import MessengerService from '../services/messenger-service';

interface HomeState {
    chats: ChatInstance[];
}

export class Home extends React.Component<RouteComponentProps<{}>, HomeState> {
    private userIdInput: HTMLInputElement | null | undefined;

    constructor() {
        super();

        this.state = { chats: App.getChats() };
        let instance = this;

        this.copyId = this.copyId.bind(this);
        this.whatsAppSend = this.whatsAppSend.bind(this);
        this.onSubmit = this.onSubmit.bind(this);
        this.onChatAdded = this.onChatAdded.bind(this);
        this.onConnected = this.onConnected.bind(this);
        this.onMessageReceived = this.onMessageReceived.bind(this);

        //Add App event handlers
        App.onChatAdded.add(this.onChatAdded);
        App.onConnected.add(this.onConnected);
        App.onMessage.add(this.onMessageReceived);
    }

    private onChatAdded(args: ChatAddedParams) {
        this.setState({ chats: args.chats });
    }

    private onConnected(id: string) {
        this.userIdInput && (this.userIdInput.value = id);
    }

    private onMessageReceived(msg: ChatMessage) {
        let chats = this.state.chats;
        let filtered = chats.filter(c => c.group.id === msg.groupId);
        if (filtered.length > 0) {
            let chat = filtered[0];
            chat.newMessages = true;
            this.setState({ chats: chats });
        }
    }

    public componentWillUnmount() {
        //Remove App event handlers
        App.onChatAdded.remove(this.onChatAdded);
        App.onConnected.remove(this.onConnected);
        App.onMessage.remove(this.onMessageReceived);
    }

    public render() {
        let contents = this.state.chats.length === 0
            ? <div className='no-users' style={{ textAlign: 'center' }}>Request for a new chat by typing the user id</div>
            : this.getChatsList(this.state.chats);

        return <div className='h100'>
            <div className='row form-top'>
                <div className='col-xs-12'>
                    <div className='input-group'>
                        <span className='input-group-addon'>Your ID:</span>
                        <input type='text' className='form-control' readOnly={true} ref={(r) => { this.userIdInput = r; r && (r.value = App.session.id || '') }} />
                        <span className='input-group-btn'>
                            <button className='btn image-btn whatsapp-btn' type='button' onClick={this.whatsAppSend} title='WhatsApp'></button>
                            <button className='btn btn-default' type='button' onClick={this.copyId} title='Copy'>
                                <span className='glyphicon glyphicon-copy' aria-hidden='true'></span>
                            </button>
                        </span>
                    </div>
                </div>
                <div className='col-xs-12' style={{ marginTop: 10 }}>
                    <form onSubmit={this.onSubmit} autoComplete='off'>
                        <div className='form-group' style={{ marginBottom: 0 }}>
                            <div className='input-group'>
                                <span className='input-group-addon'>Connect to:</span>
                                <input id='userIdElement' type='text' className='form-control' name='userId' placeholder="Enter user id" required />
                                <span className='input-group-btn'>
                                    <button className='btn btn-default btn-success' type='submit'>Request Connection</button>
                                </span>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
            <div className='row chats-container'>
                {contents}
            </div>
        </div >;
    }

    private copyId() {
        if (App.session.id) {
            copy(App.session.id);
            alert('Copied to clipboard:\n' + App.session.id);
        }
    }

    private whatsAppSend() {
        if (App.session.id) {
            var whatsAppUrl = App.isMobile() ? 'whatsapp://' : 'https://web.whatsapp.com/';
            window.open(`${whatsAppUrl}send?text=${this.getChatLink()}`, '', 'width=900,height=700');
        }
    }

    private getChatLink() {
        return `${window.location.href}c/${App.session.id}`;
    }

    private onSubmit(event: any) {
        event.preventDefault();

        let value: string = event.target.userId.value;

        if (value.length === 0) return;

        App.requestConnection(value);
        event.target.userId.value = '';
    }

    private getChatsList(chats: ChatInstance[]) {
        return <div className='col-xs-12 h100'>
            <h4>Active Chats</h4>
            <div id='chatsList' className='list-group'>
                {chats.map(c =>
                    <Link key={c.group.id} id={c.group.id} to={`/c/${c.group.id}`} className='list-group-item'>
                        <h4 className='list-group-item-heading'>{c.group.users.map(u => u.name).join(', ')} {c.newMessages ? <span className='badge pull-right'>new messages</span> : ''}</h4>
                    </Link>
                )}
            </div>
        </div>;
    }
}
