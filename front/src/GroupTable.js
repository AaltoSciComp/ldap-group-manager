import React, { Component } from 'react';
import './App.css';
import { Table, Button, Popover, OverlayTrigger, FormControl, ButtonGroup } from 'react-bootstrap';
import { BsCalendar } from 'react-icons/bs';

class GroupTable extends Component {

  render() {
    const g = this.props.group;
    return (<Table size="sm" bordered hover>
      <thead>
        <tr>
          <th>Display name</th>
          <th>Username</th>
          <th>Email address</th>
          <th>Expiry</th>
          <th>History</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
      {
        g.members.map(m => <GroupMemberLine key={m.dn} getGroupUserChangeHistory={this.props.getGroupUserChangeHistory} removeMemberFromGroup={this.props.removeMemberFromGroup} editExpiry={this.props.editExpiry} g={g} m={m} />)
      }
      </tbody>
    </Table>)
  }
}

class GroupMemberLine extends Component {

  constructor(props) {
    super(props);
    this.expiryDateInput = React.createRef();
    this.removeMemberFromGroup = this.removeMemberFromGroup.bind(this);
    this.getGroupUserChangeHistory = this.getGroupUserChangeHistory.bind(this);
    this.editExpiry = this.editExpiry.bind(this);
    this.clearExpiry = this.clearExpiry.bind(this);
    this.selectedExpiryDate = this.expiry ? this.expiry.expiryDate.split('T')[0] : null;
  }

  removeMemberFromGroup() {
    return this.props.removeMemberFromGroup(this.props.m, this.props.g);
  }

  getGroupUserChangeHistory(ev) {
    return this.props.getGroupUserChangeHistory(ev, this.props.g, this.props.m.sAMAccountName)
  }

  editExpiry(ev) {
    return this.props.editExpiry(ev, this.props.g, this.props.m.sAMAccountName, this.expiryDateInput.current.value)
  }

  clearExpiry(ev) {
    return this.props.editExpiry(ev, this.props.g, this.props.m.sAMAccountName, null)
  }

  makeExpiryCellSpan() {
    let expiry = this.props.g.expiries[this.props.m.sAMAccountName];
    const popoverEdit = (
      <Popover style={{padding: "10px"}} id="date-popover" title="Pick a date">
        <FormControl type="date" defaultValue={expiry ? expiry.expiryDate.split('T')[0] : null} id="expiryDateInput" ref={this.expiryDateInput} />
        <Button style={{marginTop: "10px"}} onClick={this.editExpiry} variant="primary">Save</Button>
      </Popover>
    );

    let buttonVariant = "outline-secondary";
    let buttonContent;

    if (expiry) {
      buttonContent = new Date(expiry.expiryDate).toLocaleDateString()
      if (new Date(expiry.expiryDate) < new Date()) {
        buttonVariant = "outline-danger";
      }
    } else {
      buttonContent = (
        <BsCalendar />
      )
    }

    const popoverClear = (
      <Popover style={{padding: "10px"}}>
        <Button onClick={this.clearExpiry} variant="outline-danger">Clear membership expiry</Button>
      </Popover>
    )

    return (
      <ButtonGroup>
        <OverlayTrigger
          rootClose
          placement='top'
          trigger="click"
          overlay={popoverEdit}
        >
          <Button ref={this.editExpiryButton} size="sm" variant={buttonVariant}>
            {buttonContent}
          </Button>
        </OverlayTrigger>
        {expiry ? <OverlayTrigger
          rootClose
          placement='top'
          trigger="click"
          overlay={popoverClear}
        >
          <Button ref={this.clearExpiryButton} size="sm" variant={buttonVariant}>
            Clear
          </Button>
        </OverlayTrigger> : null}
      </ButtonGroup>
    )
  }

  render() {
    const { m } = this.props;
    return (
      <tr>
        <td>{m.displayName}</td>
        <td>{m.sAMAccountName}</td>
        <td>{m.mail}</td>
        <td>{this.makeExpiryCellSpan()}</td>
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
