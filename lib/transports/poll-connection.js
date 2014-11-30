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
//
// If we want this to reflect a ws style connection, we need to reflect the
// interface by adding something like _sender, _receiver, _isServer, etc...

var util = require("util");
var events = require("events");

// var PollClient = function(client, config) {
var PollConnection = function(request, response, clientInfo, relay) {
  debug.conn('Starting up a new PollConnection');
  events.EventEmitter.call(this);
  this.setMaxListeners(0);

  this.request                = request;
  this.response               = response;
  this.clientInfo             = clientInfo;
  this.relay                  = relay;

  this.CONNECTING             = 0;               // const readyState state
  this.OPEN                   = 1;               // const readyState state
  this.CLOSING                = 2;               // const readyState state
  this.CLOSED                 = 3;               // const readyState state
  this.readyState             = this.CONNECTING; // readonly

  this.setupListeners();
};
util.inherits(PollConnection, events.EventEmitter);
module.exports = PollConnection;


PollConnection.prototype.setupListeners = function() {
  // This is the indicator for start of sending the messages - connection is
  // effectively unavailable from here on, till end, finish or close has been
  // emitted, followed by a successfull open event:
  // pollConnection:sending

  // This the indicator of a connection being aborted or otherwise closed before
  // any messages could be send:
  // request:aborted
  // request:close
  // response:close

  // The following events are indicators of successfully sending messages:
  // response:finish
  // request:end

  // The above is also the order in which the events seems to emitted

  this.request.on( 'end',     this.setStateAsClosing.bind(this, 'request:end'));
  this.request.on( 'close',   this.setStateAsClosing.bind(this, 'request:close'));
  this.request.on( 'error',   this.setStateAsClosing.bind(this, 'request:error'));
  this.request.on( 'finish',  this.setStateAsClosing.bind(this, 'request:finish'));
  this.request.on( 'aborted', this.setStateAsClosing.bind(this, 'request:aborted'));
  this.response.on('end',     this.setStateAsClosing.bind(this, 'response:end'));
  this.response.on('close',   this.setStateAsClosing.bind(this, 'response:close'));
  this.response.on('error',   this.setStateAsClosing.bind(this, 'response:error'));
  this.response.on('finish',  this.setStateAsClosing.bind(this, 'response:finish'));
  this.on(         'sending', this.setStateAsClosing.bind(this, 'pollConnection:sending'));

  this.readyState = this.OPEN;

  this.send();
};

PollConnection.prototype.setStateAsClosing = function(eventName) {
  debug.conn('Starting to close due to event: '+eventName);
  // To make sure, the poll connection handler removes the reference
  this.relay.removeListener('message:send:'+this.clientInfo.connId, this.send.bind(this));
  this.readyState = this.CLOSING;
  this.emit('closing');
};

// SERVER -> BROWSER - This going to be FROM the server TO the browser
PollConnection.prototype.send = function() {
  this._ping = new Date().getTime();

  debug.msgOut('Fetching send messages:');

  if(this.readyState !== this.OPEN) {
    debug.msgOut('trying so send, but connection is closed');
    debug.msgOut(this.readyState);
    return;
  }

  this.relay.getSendMessages(this.clientInfo.connId, function(err, messages) {

    if(!err && messages) {
      debug.msgOut('Sending messages to browser:');


      this.response.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      });

      this.response.write(JSON.stringify(messages));

      if(this.readyState !== this.OPEN) {
        debug.msgOut('trying so send, but connection is closed');
        debug.msgOut(this.readyState);
        this.relay.reSend(this.clientInfo.connId, messages);
        // Tell relay to reSend these - NOT send... RE send!
        return;
      }

      this.emit('sending');

      this.response.end();

    } else {
      this.relay.once('sock.it:sendQueue:'+this.clientInfo.connId, this.send.bind(this));
    }
  }.bind(this));

};
