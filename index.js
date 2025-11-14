const express = require('express')
const bodyParser = require('body-parser')
const ldap = require('ldapjs')
const fs = require('fs')
const assert = require('assert')
const _ = require('lodash')
const session = require('express-session');
const passport = require('passport');
const yaml = require('yaml')
const Promise = require('bluebird')
const SQLiteStore = require('connect-sqlite3')(session)

const config = require('./config')

const GroupModifyEvent = require('./models/GroupModifyEvent')

const app = express()
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }))

/*
    OIDC auth modeled after guide:
    https://developer.okta.com/blog/2018/05/18/node-authentication-with-passport-and-oidc 
*/

// express-session
app.use(session({
  store: new SQLiteStore,
  secret: config.EXPRESS_SESSION_SECRET,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }, // 1 week
  resave: false,
  saveUninitialized: true
}));

// passport
app.use(passport.initialize());
app.use(passport.session());
passport.use(config.PASSPORT_STRATEGY_NAME, config.PASSPORT_STRATEGY);

passport.serializeUser((user, next) => {
  next(null, user);
});

passport.deserializeUser((obj, next) => {
    obj.username = obj.preferred_username.split('@')[0];
    next(null, obj);
});

// Init some global vars
const ADMIN_GROUP_NAME = config.LDAP_ADMIN_GROUP_NAME;
const port = 3000
const base = config.LDAP_SEARCH_BASE
const USER_CACHE = {}
const GROUPS = {}
const DATA_SOURCES = yaml.parse(fs.readFileSync('./group-metadata/dir.yaml', 'utf8'));


// Create and destroy a new client for each LDAP request. Apparently the recommended way of avoiding client timeouts.
const makeLdapClient = async (reject) => {

    return new Promise((resolve, reject) => {
        const client = ldap.createClient({
            url: config.LDAP_URL,
            reconnect: false,
//            tlsOptions: {
//                ca: config.LDAP_CA,
//		//checkServerIdentity: () => { return null; },
//            }
        })
        client.bind(
            config.LDAP_BIND_DN,
            config.LDAP_BIND_PW,
            err => {
                assert.ifError(err);
                return resolve(client);
            }
        )

    })

    return client;
}

// Promisified wrapper for ldapClient.search. opts parameter from http://ldapjs.org/client.html#search
async function ldapSearch(opts) {
    return new Promise(async (resolve, reject) => {
        const client = await makeLdapClient(reject);

        client.search(base, opts, (err, result) => {
            assert.ifError(err);
            if (err) {
                return reject(err)
            }
            const foundEntries = [];
            result.on('searchEntry', function(entry) {
                const resObj = entry.object
                foundEntries.push(resObj)
            });
            result.on('error', err => {
                client.destroy();
                return reject(err);
            });
            result.on('end', result => {
                client.destroy();
                return resolve(foundEntries);
            });
        })
    })
}

// Promisified wrapper for ldapClient.modify. groupDN is the DN of the group in question, changes is an array of LDIF objects
async function ldapModify(groupDN, changes) {
    return new Promise(async (resolve, reject) => {
        const client = await makeLdapClient(reject);
        client.modify(groupDN, changes, (err) => {
            client.destroy();
            if (err) { return reject(err) }
            return resolve({});
        })
    })
}

// Input an array of group names, return promise resolving to the group AD objects
async function searchGroups(groups) {
    let gString = '';
    _.forEach(groups, g => {
        gString += `(samaccountname=${g})`
    });
    return ldapSearch({ filter: `(&(objectClass=group)(|${gString}))`, scope: 'sub', attributes: ['cn', 'memberUid', 'sAMAccountName'] })
}

// Input an array of usernames / emails, return a promise resolving to AD user objects of all the groups
async function searchUsers(userIdentifiers) {
    let uString = '';
    const users = [];
    // Search ldap for users missing from USER_CACHE
    _.forEach(userIdentifiers, u => {
        if (USER_CACHE[u]) {
            users.push(USER_CACHE[u])
        } else {
            const searchKey = u.indexOf('@') < 0 ? 'samaccountname' : 'mail';
            uString += `(${searchKey}=${u})`
        }
    })
    if ( uString.length > 0 ) {
        const ldapUsers = await ldapSearch({ filter: `(&(objectClass=person)(|${uString}))`, scope: 'sub', attributes: ['displayName', 'sAMAccountName', 'mail'] });
        _.forEach(ldapUsers, u => {
            USER_CACHE[u.sAMAccountName] = u;
            if (u.mail) { USER_CACHE[u.mail] = u; }
            users.push(u);
        })
    }

    return users;
}

// Input arrays of AD groups / users, return the groups with detailed user info ready to be sent to frontend
function parseGroupSearchResults(groups) {
    groups = groups.map(g => {
        if (typeof g.memberUid === 'string') { g.memberUid = [ g.memberUid ] }
        if (!g.memberUid) { g.memberUid = [] }
        // Map member usernames to the user objects
        g.members = g.memberUid.map(u => {
            return USER_CACHE[u];
        });
        delete g.memberUid;
        return g
    })
    return groups;
}

function getUserManagedGroups(user) {
    let pickedGroups; 
    if ( ADMIN_USERNAMES.indexOf(user.username) >= 0 ) {
        pickedGroups = GROUPS;
    } else {

        pickedGroups = _.pickBy(GROUPS, g => { return g.managers && !!_.find(g.managers, {sAMAccountName: user.username})});
    }
    return pickedGroups;
}

function getUserManagedGroupNames(user) {
    return _.keys(getUserManagedGroups(user));
}

function ensureLoggedIn(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }

    res.redirect('/login')
}


app.use('/login', passport.authenticate(config.PASSPORT_STRATEGY_NAME));

app.use('/auth/callback',
    passport.authenticate(config.PASSPORT_STRATEGY_NAME, { failureRedirect: '/error' }),
    (req, res) => {
        res.redirect('/');
    }
);

app.get('/api/managedGroups', ensureLoggedIn, async (req, res) => {
    const groups = getUserManagedGroups(req.user);
    const groupNames = _.keys(groups);
    if (groupNames.length > 0) {
        const ldapGroups = await searchGroups(groupNames);

        // Search for users from groups
        let usernames = [];
        _.forEach(ldapGroups, g => {
            if (g.memberUid) {
                usernames = usernames.concat(g.memberUid)
            }
        });
        usernames = _.uniq(usernames);
        const users = await searchUsers(usernames);

        const mergedGroups = _.map(ldapGroups, g => {
            g = _.merge(g, groups[g.sAMAccountName.toLowerCase()]);
            return g;
        });

        return res.send(parseGroupSearchResults(mergedGroups, users));
    } else {
        return res.send([]);
    }
})

app.get('/api/findUsers', ensureLoggedIn, async (req, res) => {
    let search;
    if (req.query.username) {
        search = `sAMAccountName=${req.query.username}`
    } else if (req.query.email) {
        search = `mail=${req.query.email}`
    } else if (req.query.firstname || req.query.surname) {
        const fn = req.query.firstname, sn = req.query.surname;
        if (fn.length && sn.length) {
            search = `(&(givenName=${fn})(sn=${sn}))`
        } else if (fn.length) {
            search = `givenName=${fn}`
        } else if (sn.length) {
            search = `sn=${sn}`
        } else {
            return res.send({});
        }
    } else {
        return res.send({});
    }

    const users = await ldapSearch({ filter: search, scope: 'sub', attributes: ['displayName', 'sAMAccountName', 'mail'] });
    res.send(users);
})

app.get('/api/groupChanges', ensureLoggedIn, async (req, res) => {
    const groupName = req.query.groupName;
    const groupNames = getUserManagedGroupNames(req.user);
    if (groupNames.indexOf(groupName) === -1) { return res.status(403).send("Forbidden") }
    const events = await GroupModifyEvent.find({ group: groupName }).sort({timestamp: -1}).exec();
    return res.send(events);
})

app.get('/api/groupUserChanges', ensureLoggedIn, async (req, res) => {
    const groupName = req.query.groupName;
    const username = req.query.username;
    const groupNames = getUserManagedGroupNames(req.user);
    if (groupNames.indexOf(groupName) === -1) { return res.status(403).send("Forbidden") }
    const events = await GroupModifyEvent.find({ group: groupName, targetPerson: username }).sort({timestamp: -1}).exec();
    return res.send(events);
})

async function modifyGroup(req, res, opType) {
    const groupName = req.body.groupName;
    const user = req.body.user;
    const groupNames = getUserManagedGroupNames(req.user);
    if (groupNames.indexOf(groupName) === -1) { return res.status(403).send("Forbidden") }
    const groups = await searchGroups([groupName]);
    if (groups.length !== 1) { res.status(400).send(`Found ${groups.length} groups instead of one`) }
    const group = groups[0];
    const change1 = new ldap.Change({
        operation: opType,
        modification: {
            member: [user.dn]
        }
    });
    const change2 = new ldap.Change({
        operation: opType,
        modification: {
            memberUid: [user.sAMAccountName]
        }
    });
    try {
        modifyRes = await ldapModify(group.dn, [change1, change2])
        GroupModifyEvent.create({
            operation: opType,
            targetPerson: user.sAMAccountName,
            changedBy: req.user.username,
            group: req.body.groupName,
            comments: req.body.comments
        });
        res.send(modifyRes);
    } catch (err) {
        res.status(400).send({
            code: err.code,
            message: err.message,
            name: err.name
        });
    }
}

app.post('/api/addGroupMember', ensureLoggedIn, (req, res) => modifyGroup(req, res, 'add'));

app.delete('/api/deleteGroupMember', ensureLoggedIn, (req, res) => modifyGroup(req, res, 'delete'));

app.get('/api/dataSources', ensureLoggedIn, (req, res) => res.send(DATA_SOURCES));

app.get('/api/ownGroups', ensureLoggedIn, async (req, res) => {
    const user = req.user;
    const groupsRes = await ldapSearch({ filter: `(&(objectClass=person)(sAMAccountName=${user.username}))`, scope: 'sub', attributes: ['memberOf'] });
    const groupDNs = groupsRes[0].memberOf;
    const groupNames = groupDNs.map(g => {
        return g.split(",")[0].split("=")[1].toLowerCase();
    });
    let groups = groupNames.map(g => {
        return GROUPS[g] ? _.extend(GROUPS[g], {haveInfo: true}) : { cn: g, haveInfo: false }
    })
    res.send(groups);
})

app.get('/api/departmentGroups', ensureLoggedIn, async (req, res) => {
    const user = req.user;
    const ldapRes = await ldapSearch({ filter: `(&(objectClass=person)(sAMAccountName=${user.username}))`, scope: 'sub', attributes: ['edupersonorgunitdn'] });
    const isDepartmentMember = ldapRes[0].eduPersonOrgUnitDN.indexOf(config.DEPARTMENT_MEMBERS_DN) >= 0;
    if (isDepartmentMember) {
        return res.send(Object.values(GROUPS))
    } else {
        res.status(403).send("Forbidden from non-department members.");
    }
})

// Authenticated access to anything but login
app.use([ensureLoggedIn, express.static(__dirname + "/front/build/")])

let ADMIN_USERNAMES = []
ldapSearch({ filter: `(&(objectClass=group)(samaccountname=${ADMIN_GROUP_NAME}))`, scope: 'sub', attributes: ['memberUid'] })
.then(r => {
    ADMIN_USERNAMES = r[0].memberUid;
})

app.listen(port, async () => {

    let groupUsernames = [];
    _.forEach(DATA_SOURCES, (ds, dsTag) => {
        let data = yaml.parse(fs.readFileSync('./group-metadata/' + ds.filename, 'utf8'));
        _.forEach(data, (group, groupName) => {
            group.dataSource = dsTag;
            GROUPS[groupName] = group;
            GROUPS[groupName].cn = groupName;
            if (group.managers) {
                groupUsernames = groupUsernames.concat(group.managers)
            }
            if (group.owners) {
                groupUsernames = groupUsernames.concat(group.owners)
            }
        })
    });
    groupUsernames = _.uniq(groupUsernames);
    await searchUsers(groupUsernames); // Owners and managers are now in cache
    _.forEach(GROUPS, (g, gName) => {
        g.owners = _.map(g.owners, uName => {return USER_CACHE[uName]})
        g.managers = _.map(g.managers, uName => {return USER_CACHE[uName]})
    })

    console.log(`Listening on port ${port}`);
})
