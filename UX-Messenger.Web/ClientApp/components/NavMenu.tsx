import * as React from 'react';
import { NavLink } from 'react-router-dom';

export class NavMenu extends React.Component<{}, {}> {
    public render() {
        return <div>
            <div className='info-nav top-nav'>
                <NavLink to='/'>UX-Messenger</NavLink>
            </div>
            {/*<div className='navbar navbar-inverse navbar-default main-nav top-nav' >
                <div className='container-fluid'>
                    <ul className='nav navbar-nav w100 text-center'>
                        <li className='w50'>
                            <NavLink to={'/'} exact activeClassName='active'>
                                <span className='glyphicon glyphicon-comment'></span> Chats
                            </NavLink>
                        </li>
                        <li className='w50'>
                            <NavLink to={'/settings'} activeClassName='active'>
                                <span className='glyphicon glyphicon-cog'></span> Settings
                            </NavLink>
                        </li>
                    </ul>
                </div>
            </div>*/}</div>;
    }
}
