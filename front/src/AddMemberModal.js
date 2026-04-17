import React, { Component } from 'react';
import { Modal, Button, InputGroup, FormControl } from 'react-bootstrap';
import './App.css';
import FoundUsersTable from './FoundUsersTable'
import _ from 'lodash';

class AddMemberModal extends Component {

  constructor(props) {
    super(props);
    this.usernameInput = React.createRef();
    this.emailInput = React.createRef();
    this.firstnameInput = React.createRef();
    this.surnameInput = React.createRef();
    this.commentsInput = React.createRef();
    this.expiryDateInput = React.createRef();
    this.state = {  }
  }

  onDismiss = () => {
    this.setState({
      user: undefined,
      users: undefined
    });
    this.props.onDismiss();
  }

  onConfirm = (user, comments, expiryDate) => {
    this.setState({
      user: undefined,
      users: undefined
    });
    this.props.onConfirm(user, comments, expiryDate)
  }

  searchBy = (type) => {
    let fetchUrl;
    switch (type) {
      case "email":
        fetchUrl = `/api/findUsers?email=${this.emailInput.current.value}`;
        break;
      case "username":
        fetchUrl = `/api/findUsers?username=${this.usernameInput.current.value}`;
        break;
      case "names":
        const firstname = this.firstnameInput.current.value;
        const surname = this.surnameInput.current.value;
        fetchUrl = `/api/findUsers?firstname=${firstname}&surname=${surname}`
        break;
      default:
        console.log("Unknown search field type: " + type);
    }
    fetch(fetchUrl)
    .then(r => r.json())
    .then(u => {
      let selectedUser;
      if ( u.length === 1 && !_.find(this.props.group.members, {dn: u[0].dn}) ) { selectedUser = u[0] }
      this.setState({
        users: u,
        user: selectedUser
      })
    })
  }

  selectUser = (user) => {
    let u;
    if (this.state.user === undefined || this.state.user.dn !== user.dn) {
      u = user;
    }
    this.setState({
      user: u
    });
  }

  onKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.target.blur()
      if (e.target.id === 'username') { this.searchBy('username') }
      else if (e.target.id === 'email') { this.searchBy('email') }
      else if (e.target.id === 'firstname' || e.target.id === 'surname') { this.searchBy('names') }
    }
  }

  render() {
    const { group } = { ...this.props }
    const u = this.state.user;
    return (
      <Modal size="lg" show={!!group} onHide={this.onDismiss}>
        <Modal.Header closeButton>
          <Modal.Title>Add member to group {group ? group.cn : ""}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Find users by...
          <InputGroup>
            <FormControl id="username" onKeyPress={e => this.onKeyPress(e)} ref={this.usernameInput} placeholder="Username" />
            <InputGroup.Append>
              <Button onClick={() => this.searchBy('username')} variant="outline-primary" id="searchByUsernameButton">Go!</Button>
            </InputGroup.Append>
          </InputGroup>
          or
          <InputGroup>
            <FormControl id="email" onKeyPress={e => this.onKeyPress(e)} ref={this.emailInput} placeholder="Email" />
            <InputGroup.Append>
              <Button onClick={() => this.searchBy('email')} variant="outline-primary" id="searchByEmailButton">Go!</Button>
            </InputGroup.Append>
          </InputGroup>
          or at least one of
          <InputGroup>
            <FormControl id="firstname" onKeyPress={e => this.onKeyPress(e)} ref={this.firstnameInput} placeholder="First name" />
            <FormControl id="surname" onKeyPress={e => this.onKeyPress(e)} ref={this.surnameInput} placeholder="Last name" />
            <InputGroup.Append>
              <Button onClick={() => this.searchBy('names')} variant="outline-primary" id="searchByNamesButton">Go!</Button>
            </InputGroup.Append>
          </InputGroup>
          <FoundUsersTable selectedUser={u} groupMembers={group ? group.members : {}} users={this.state.users} selectUser={this.selectUser} />   
          <div>
            {
              u && u.displayName ? (
                <div>
                  Add {u.displayName} to the group?
                  <FormControl id="commentsInput" ref={this.commentsInput} placeholder="Comments" />
                  <br />
                  <h6>End date (optional, not automatic)</h6>
                  <FormControl type="date" id="expiryDateInput" ref={this.expiryDateInput} />
                </div>
              ) : ""
            }
          </div>
          
          <div>
            { this.props.error ? "Error while adding user: " + this.props.error : "" }
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button value="1" onClick={this.onDismiss} variant="outline-secondary">Cancel</Button>
          <Button value="0" disabled={!u || !u.sAMAccountName} onClick={() => this.onConfirm(u, this.commentsInput.current.value, this.expiryDateInput.current.value)} variant="primary">Add</Button>
        </Modal.Footer>
      </Modal>
    )
  }
}

export default AddMemberModal
