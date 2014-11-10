// This will actually be more or less a dummy
// When the connection has been "established", the system can send message
// But they will end up in redis and get caught by whomever has the actual
//   current poll connection
// There will come no "message" event, unless we decide that it's a good
//   idea to implement such a thing?..
//
// So this can effectively not be used to let the server request info from the
//   users...
//
// Currently we need this, as the express-sock layer attached a pubsub listener
//   that needs to be able to broadcast message, but only on the domain...
// Maybe we can find a smart fix for this???

var util = require("util");
var events = require("events");

// var PollClient = function(client, config) {
var PollConnection = function(config) {
  events.EventEmitter.call(this);
  this.setMaxListeners(0);

  this.connId                = null;

  this.CONNECTING            = 0;           // const readyState state
  this.OPEN                  = 1;           // const readyState state
  this.CLOSING               = 2;           // const readyState state
  this.CLOSED                = 3;           // const readyState state
  this.readyState            = this.CLOSED; // readonly

  this.url                   = config.url.replace(/^ws/i, 'http');

  this._initialConnectionDone = false;

  config = config || {};
  for(var key in config) this[key] = config[key];
};
util.inherits(PollConnection, events.EventEmitter);
module.exports = PollConnection;

// EMIT AN EVENT ON MESSAGES - THOSE ARE SEND FROM THE RELAY

// SERVER -> BROWSER - This going to be FROM the server TO the browser
PollConnection.prototype.send = function(message) {
  // This should assume only 1 message at a time, not an array
  debug.err('Something went wrong - send should have been overwritten');
  debug.err('url: '+this.url);
  debug.err('connId: '+this.connId);
  debug.err(message);
};

// SERVER -> BROWSER - This going to be FROM the server TO the browser
PollConnection.prototype.sendMessage = function(message) {
  debug.msgOut('POLL CONNECTION TRYING TO SEND:');
  debug.msgOut(message);

  this.response.writeHead(200, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  });
  this.response.end(message);
};

PollConnection.prototype.receiveMessage = function(message) {
  debug.msgIn('POLL CONNECTION TRYING TO RECEIVE:');
  debug.msgIn(message)
  this.emit('message', message);
};

PollConnection.prototype.sendBadRequest = function() {
  this.response.writeHead(400, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  });
  this.response.end('Bad Request');
};
