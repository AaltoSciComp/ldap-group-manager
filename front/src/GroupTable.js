import React, { Component } from 'react';
import './App.css';
import { Table, Button } from 'react-bootstrap';

class GroupTable extends Component {

  render() {
    const g = this.props.group;
    return (<Table size="sm" bordered hover>
      <thead>
        <tr>
          <th>Display name</th>
          <th>Username</th>
          <th>Email address</th>
          <th>History</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
      {
        g.members.map(m => <GroupMemberLine key={m.dn} getGroupUserChangeHistory={this.props.getGroupUserChangeHistory} removeMemberFromGroup={this.props.removeMemberFromGroup} g={g} m={m} />)
      }
      </tbody>
    </Table>)
  }
}

class GroupMemberLine extends Component {

  constructor(props) {
    super(props);
    this.removeMemberFromGroup = this.removeMemberFromGroup.bind(this);
    this.getGroupUserChangeHistory = this.getGroupUserChangeHistory.bind(this);
  }

  removeMemberFromGroup() {
    return this.props.removeMemberFromGroup(this.props.m, this.props.g);
  }

  getGroupUserChangeHistory(ev) {
    return this.props.getGroupUserChangeHistory(ev, this.props.g, this.props.m.sAMAccountName)
  }

  render() {
    const { m } = this.props;
    return (
      <tr>
        <td>{m.displayName}</td>
        <td>{m.sAMAccountName}</td>
        <td>{m.mail}</td>
        <td>
            <Button style={{width: "55px"}} onClick={this.getGroupUserChangeHistory} size="sm" variant="outline-secondary">?</Button>
        </td>
        <td>
          <Button onClick={this.removeMemberFromGroup} size="sm" variant="outline-danger">Remove</Button>
        </td>
      </tr>
    )
  }
}

export default GroupTable;
