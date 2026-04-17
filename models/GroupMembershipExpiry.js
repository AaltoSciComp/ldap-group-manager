const db = require('../db')

const groupMembershipExpirySchema = new db.Schema({
    expiryDate: { type: Date, required: true },
    targetPerson: { required: true, type: String },
    group: { required: true, type: String }
});

const GroupMembershipExpiry = db.model("GroupMembershipExpiry", groupMembershipExpirySchema);

module.exports = GroupMembershipExpiry;