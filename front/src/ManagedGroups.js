import React, { Component } from 'react';
import './App.css';
import { InputGroup, FormControl, Row, Col, Accordion } from 'react-bootstrap';
import RemoveMemberModal from './RemoveMemberModal'
import AddMemberModal from './AddMemberModal'
import GroupHistoryModal from './GroupHistoryModal'
import GroupCard from './GroupCard'
import _ from 'lodash';

class ManagedGroups extends Component {

  constructor(props) {
    super(props);
    this.config = this.props.config;
    this.makeGroupCard = this.makeGroupCard.bind(this);
    this.searchInput = React.createRef();
    this.state = { loading: true, groups: [], shownGroups: [], memberToRemove: undefined, removalGroup: undefined, groupSearchText: "" }
  }

  async componentDidMount() {
    let r = await fetch('/api/dataSources')
    this.config.dataSources = await r.json()

    r = await fetch('/api/managedGroups')
    let groups = await r.json()
    groups = _.sortBy(groups, g => {
      return g.cn.toLowerCase()
    })

    _.forEach(groups, g => {
      _.forEach(g.owners, o => {
        if (o == null) { console.log("group with null owner", g.cn) }
      })
    })

    this.setState({
      loading: false,
      groups: groups,
      shownGroups: this.getShownGroups(groups),
      activeKey: ""
    })
  }

  resetRemoveState = () => {
    this.setState({
      memberToRemove: undefined,
      removalGroup: undefined
    })
  }

  removeMemberFromGroup = (member, group) => {
    this.setState({
      memberToRemove: member,
      removalGroup: group
    });
  }

  onRemoveModalDismiss = () => {
    this.resetRemoveState();
  }

  onRemoveModalConfirm = async (user, comments) => {
    const res = await fetch('/api/deleteGroupMember', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user: user,
        comments: comments,
        groupName: this.state.removalGroup.cn
      })
    });
    await res.json();
    const removalGroup = this.state.removalGroup;
    const groups = [...this.state.groups];
    const gIdx = _.findIndex(groups, { cn: removalGroup.cn });
    const g = groups[gIdx];
    const mIdx = _.findIndex(g.members, { sAMAccountName: user.sAMAccountName });
    g.members.splice(mIdx, 1);
    groups.splice(gIdx, 1, g);
    this.setState({groups: groups, shownGroups: this.getShownGroups(groups)});
    this.resetRemoveState();
  }

  addMemberToGroup = (ev, group) => {
    ev.stopPropagation();
    this.setState({
      addGroup: group
    });
  }

  onAddModalConfirm = async (user, comments, expiryDate) => {
    const res = await fetch('/api/addGroupMember', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user: user,
        comments: comments,
        expiryDate: expiryDate,
        groupName: this.state.addGroup.cn
      })
    });
    if (res.status === 400) {
      const err = await res.json();
      if (err.code === 68) {
        this.setState({
          addError: "User is already in this group."
        })
      } else {
        this.setState({
          addError: err.name
        })
      }
      console.log(this.state.addError);
      return;
    }
    await res.json();
    const groups = [...this.state.groups];
    const g = this.state.addGroup;
    const gIdx = _.findIndex(groups, { cn: g.cn });
    g.members.push(user);
    if (expiryDate) {
      g.expiries[user.sAMAccountName] = { expiryDate: expiryDate, targetPerson: user.sAMAccountName, group: g.cn }
    }
    groups.splice(gIdx, 1, g);
    this.setState({
      groups: groups,
      shownGroups: this.getShownGroups(groups),
      addGroup: undefined,
      addError: undefined
    })
  }

  onAddModalDismiss = () => {
    this.setState({
      addGroup: undefined,
      addError: undefined
    })
  }

  getGroupChangeHistory = async (ev, group) => {
    ev.stopPropagation();
    const res = await fetch(`/api/groupChanges?groupName=${group.cn}`)
    const data = await res.json()
    this.setState({
      changeGroup: group,
      groupChanges: data
    })
  }

  getGroupUserChangeHistory = async (ev, group, username) => {
    ev.stopPropagation();
    const res = await fetch(`/api/groupUserChanges?groupName=${group.cn}&username=${username}`)
    const data = await res.json()
    this.setState({
      changeGroup: group,
      groupChanges: data
    })
  }

  onGroupSearchChange = (e) => {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.setState({
        shownGroups: this.getShownGroups(this.state.groups, this.searchInput.current.value),
      })
    }, 250)
  }

  getShownGroups = (groups, text) => {
    const searchText = typeof text !== "undefined" ? text : this.state.groupSearchText;
    return _.filter(groups, g => {
      return g.cn.toLowerCase().indexOf(searchText.toLowerCase()) >= 0;
    });
  }

  makeGroupCard(g) {
    return (
      <GroupCard
        key={g.dn}
        group={g}
        addMemberToGroup={this.addMemberToGroup}
        getGroupChangeHistory={this.getGroupChangeHistory}
        getGroupUserChangeHistory={this.getGroupUserChangeHistory}
        removeMemberFromGroup={this.removeMemberFromGroup}
      />
    )
  }

  makeExpiredMemberGroupsSection() {
    const groupsWithExpiredMembers = _.filter(this.state.groups, g => {
      return _.some(g.expiries, e => e.expiryDate && new Date(e.expiryDate) < new Date())
    })
    if (groupsWithExpiredMembers.length === 0) {
      return <div></div>;
    }
    return (
      <Col style={{marginBottom: "15px"}}>
        <h6>The following groups you manage have expired members:</h6>
        {
          _.map(groupsWithExpiredMembers, g => {
            return (
              <div key={g.dn}>
                <a href={`#${g.dn}-card`}>{g.cn}</a><br />
              </div>
            )
          })
        }
      </Col>
    )
  }


  render() {
    return (
      <>
      <Row>
        <Col>
          <InputGroup style={{margin: "15px 0px"}}>
            <FormControl
              ref={this.searchInput}
              placeholder="Filter groups by name"
              onChange={this.onGroupSearchChange}
            >
            </FormControl>
          </InputGroup>

        </Col>
      </Row>
      <Row>
        {this.makeExpiredMemberGroupsSection()}
      </Row>
      <Accordion>
        {
          this.state.shownGroups.map(this.makeGroupCard)
        }
      </Accordion>
      {
        !this.state.loading && this.state.groups.length === 0 ? "You don't seem to have any groups to manage." : ""
      }
      <RemoveMemberModal onConfirm={this.onRemoveModalConfirm} onDismiss={this.onRemoveModalDismiss} member={this.state.memberToRemove} group={this.state.removalGroup} />
      <AddMemberModal error={this.state.addError} onConfirm={this.onAddModalConfirm} onDismiss={this.onAddModalDismiss} group={this.state.addGroup} />
      <GroupHistoryModal
        onDismiss={() => { this.setState({changeGroup: undefined, groupChanges: undefined }) }}
        group={this.state.changeGroup}
        changes={this.state.groupChanges}
      />
      </>
    )
  }

}

export default ManagedGroups
