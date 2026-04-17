const passport = require('passport');
const util = require('util');

function StrategyMock(options = {}) {
  passport.Strategy.call(this);
  this.name = 'mock';
  this.user = options.user || { preferred_username: 'abc@localtest.com', id: 'abc@localtest.com', username: 'abc' };
  this.loginPath = options.loginPath || '/login';
  this.callbackPath = options.callbackPath || '/auth/callback';
}
util.inherits(StrategyMock, passport.Strategy);

StrategyMock.prototype.authenticate = function (req) {
  // When mounted via app.use('/path', ...), use baseUrl to detect which route we're on
  const where = req.baseUrl || req.originalUrl || req.url;

  if (where === this.loginPath) {
    // Emulate IdP redirect
    return this.redirect(this.callbackPath + '?mock=1');
  }

  if (where === this.callbackPath) {
    // Complete login
    return this.success(this.user);
  }

  // If the strategy is invoked elsewhere, fail (or redirect to login)
  return this.fail();
};

module.exports = StrategyMock;
