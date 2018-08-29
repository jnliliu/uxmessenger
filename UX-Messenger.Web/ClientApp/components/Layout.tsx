import * as React from 'react';
import { NavMenu } from './NavMenu';
import App from '../App';
import { UserDisconnectedParams, InputNameParams } from '../Interfaces';
import { Alert } from 'react-bootstrap';

export interface LayoutProps {
    children?: React.ReactNode;
}

interface MainState {
    ready: boolean;
    alerts: string[];
}

export class Layout extends React.Component<LayoutProps, MainState> {
    constructor() {
        super();

        this.state = { ready: App.session.ready, alerts: [] };

        this.onReady = this.onReady.bind(this);
        this.handleAlertDismiss = this.handleAlertDismiss.bind(this);
        this.userDisconnectedHandler = this.userDisconnectedHandler.bind(this);
        this.inputNameHandler = this.inputNameHandler.bind(this);

        App.onReady.add(this.onReady);
        App.inputName.add(this.inputNameHandler);
        App.onUserDisconnected.add(this.userDisconnectedHandler);
    }

    private onReady(b: null) {
        this.setState({ ready: true });
    }

    private inputNameHandler(args: InputNameParams) {
        let name = prompt(args.text);
        args.callback(name);
    }

    private userDisconnectedHandler(args: UserDisconnectedParams) {
        let alerts = this.state.alerts;
        alerts.push(`${args.user.name || args.user.id} is disconnected!`);
        this.setState({ alerts: alerts });
    }

    public componentWillUnmount() {
        App.onReady.remove(this.onReady);
        App.onUserDisconnected.remove(this.userDisconnectedHandler);
        App.inputName.remove(this.inputNameHandler);
    }

    public render() {
        return (
            <div className='h100 w100' >
                {this.state.alerts && this.getAlertsContent()}
                <NavMenu />
                <div className='container-fluid main-container'>
                    {this.props.children}
                </div>
                {this.state.ready || <div className='block-ui-info'><div className='ui-info-msg'>Generating encryption keys...<div className='loader'></div></div></div>}
            </div>
        );
    }

    private handleAlertDismiss(index: number) {
        let alerts = this.state.alerts;
        alerts.splice(index, 1);
        this.setState({ alerts: alerts });
    }

    private getAlertsContent() {
        return <div id='alerts-container'>
            {this.state.alerts.map((a, i) => <Alert key={i} bsStyle='warning' onDismiss={() => this.handleAlertDismiss(i)}>{a}</Alert>)}
        </div>;
    }
}
