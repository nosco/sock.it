var uuid = require('node-uuid');
var Cookies = require('cookie-tools');
var util = require("util");
var events = require("events");

var DefaultRelay = function(config) {
  if(DefaultRelay.prototype._singleton) {
    return DefaultRelay.prototype._singleton;
  }
  DefaultRelay.prototype._singleton = this;

  events.EventEmitter.call(this);
  this.setMaxListeners(0);

  config = config || {};

  for(var i in config) this[i] = config[i];

  this.clientsByConnId = {};
};
util.inherits(DefaultRelay, events.EventEmitter);
module.exports = DefaultRelay;

DefaultRelay.prototype.getClientInfo = function(connId) {
  return this.clientsByConnId[connId];
};

DefaultRelay.prototype.createClient = function(clientInfo) {
  clientInfo.connId = clientInfo.connId || this._generateId();
  clientInfo.lastActivity = new Date();
  return this.clientsByConnId[clientInfo.connId] = clientInfo;
};

// Check out that this actually holds true!...
DefaultRelay.prototype.cleanupClients = function() {
  var now = new Date();
  // var minAge = now.setTime(now.getTime() + (3600 * 1000)); // 1 hour
  var minAge = now.setTime(now.getTime() - (60 * 1000)); // 60 sec

  for(var connId in this.clientsByConnId) {
    if(this.clientsByConnId[connId].lastActivity < minAge) {
      this.clientsByConnId[connId].emit('close', this.clientsByConnId[connId]);
      delete this.clientsByConnId[connId];
    }
  }
};

DefaultRelay.prototype._generateId = function() {
  return uuid.v1();
};
