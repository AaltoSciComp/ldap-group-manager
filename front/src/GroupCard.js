import React, { Component } from 'react';
import { Button, Card, Accordion, Badge, OverlayTrigger, Tooltip } from 'react-bootstrap';
import GroupTableBlock from './GroupTableBlock'
import GroupInfoTable from './GroupInfoTable'
import { BsChevronDown, BsBook } from 'react-icons/bs';
import { MdPersonAdd } from 'react-icons/md';
import ConfigContext from './ConfigContext'

const defaultTooltipText = "Copy group members to clipboard"

class GroupCard extends Component {

  static contextType = ConfigContext;

  constructor(props) {
    super(props);
    this.copyButton = React.createRef();
    this.getGroupChangeHistory = this.getGroupChangeHistory.bind(this);
    this.addMemberToGroup = this.addMemberToGroup.bind(this);
    this.state = {
      tooltipShown: false,
      tooltipText: defaultTooltipText
    }
  }

  copyGroupToClipboard = (g) => {
    this.setState({
      tooltipText: "Copied!"
    })
    const memberLines = g.members.map(m => {
      const name = m.displayName, username = m.sAMAccountName;
      const spaces = " ".repeat(12 - username.length);
      return username + spaces + name;
    });
    const textToCopy = memberLines.join('\n');
    const textField = document.createElement('textarea')
    textField.innerHTML = textToCopy;
    document.body.appendChild(textField);
    textField.select();
    document.execCommand('copy');
    textField.remove()
  }

  getGroupChangeHistory(ev) {
    return this.props.getGroupChangeHistory(ev, this.props.group);
  }

  addMemberToGroup(ev) {
    return this.props.addMemberToGroup(ev, this.props.group);
  }

  render() {    
    const { group, removeMemberFromGroup, getGroupUserChangeHistory } = { ...this.props }
    const ds = this.context.dataSources[group.dataSource];
    return (
      <Card>
        <Accordion.Toggle style={{display: "flex", flexDirection: "row", justifyContent: "center"}} as={Card.Header} eventKey={group.dn}>
          <span style={{fontSize: "1.2rem", fontWeight: "500"}}>
            { group.cn }
          </span>

          
          <div style={{display: "flex", flexGrow: "1"}} />
          <div id="groupAccordionButtons" style={{marginRight: "15px"}}>
            <OverlayTrigger
              placement="top"
              overlay={
                <Tooltip>
                  Add member
                </Tooltip>
              }
            >
              <Button ref={this.addPersonButton} style={{"marginLeft": "10px"}} size="sm" onClick={this.addMemberToGroup} variant="outline-success">
                <MdPersonAdd style={{fontSize: "19px"}} />
              </Button>
            </OverlayTrigger>

            <OverlayTrigger
              placement="top"
              overlay={
                <Tooltip>
                  Show change history
                </Tooltip>
              }
            >
              <Button style={{"marginLeft": "10px"}} size="sm" onClick={this.getGroupChangeHistory} variant="outline-secondary">
                <BsBook style={{fontSize: "19px"}}/>
              </Button>
            </OverlayTrigger>
          </div>
          <span style={{fontSize: "16px", marginRight: "10px"}}>
            <Badge pill style={{ backgroundColor: ds['badge-background'], color: ds['badge-text'] }}>{ds.tag}</Badge>
          </span>
          <BsChevronDown style={{fontSize: "1.5rem"}} />
        </Accordion.Toggle>
        <Accordion.Collapse eventKey={group.dn}>
          <Card.Body>
            <GroupInfoTable group={group}/>
            <GroupTableBlock getGroupUserChangeHistory={getGroupUserChangeHistory} removeMemberFromGroup={removeMemberFromGroup} group={group}/>
          </Card.Body>
        </Accordion.Collapse>
      </Card>
    )
  }
}

export default GroupCard
