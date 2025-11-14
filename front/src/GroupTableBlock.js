import React, { Component } from 'react';
import { Button, Overlay, Tooltip } from 'react-bootstrap';
import GroupTable from './GroupTable'
import { FaCopy } from 'react-icons/fa';

const defaultTooltipText = "Copy group members to clipboard"

class GroupTableBlock extends Component {

  constructor(props) {
    super(props);
    this.copyButton = React.createRef();
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

  render() {
    const { group, removeMemberFromGroup, getGroupUserChangeHistory } = { ...this.props }
    const { tooltipShown, tooltipText } = { ...this.state }
    return (
      <>
        <div style={{display: "flex", flexDirection: "row", alignItems: "end"}}>
          <div style={{fontSize: "18px", marginLeft: "2px"}}>Group members</div>
          <Button
            size="sm"
            variant="outline-secondary"
            style={{marginLeft: "auto"}}
            ref={this.copyButton}
            onMouseOver={() => this.setState({tooltipShown: true})}
            onMouseLeave={() => this.setState({tooltipShown: false, tooltipText: defaultTooltipText})}
            onClick={() => this.copyGroupToClipboard(group)}
          >
            <FaCopy />
          </Button>
          <Overlay target={this.copyButton} show={tooltipShown} placement="top">
            <Tooltip>
              { tooltipText }
            </Tooltip>
          </Overlay>
        </div>
        <GroupTable key={group.cn} group={group} removeMemberFromGroup={removeMemberFromGroup} getGroupUserChangeHistory={getGroupUserChangeHistory}></GroupTable>
      </>
    )
  }
}

export default GroupTableBlock
