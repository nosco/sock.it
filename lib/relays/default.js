// WOULD IT BE A GOOD IDEA TO LET OTHER RELAYS INHERIT OR PROTOTYPE ON THE
// DEFAULT RELAY?

var util = require('util');
var events = require('events');

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

  this.CONNECTING = 0;
  this.OPEN       = 1;
  this.CLOSING    = 2;
  this.CLOSED     = 3;
  this.SENDING    = 4; // Special internal state

  setInterval(this.cleanup.bind(this), (this.cleanupInterval * 1000));

  global.debug.relay('DefaultRelay:constructor');
};
util.inherits(DefaultRelay, events.EventEmitter);
module.exports = DefaultRelay;

DefaultRelay.prototype.getClient = function(connId, cb) {
  debug.relay('DefaultRelay:getClient');
  if(this.clientsByConnId[connId]) {
    this.clientsByConnId[connId]._ping = new Date().getTime();

    cb(null, this.clientsByConnId[connId]);
  } else {
    cb(null, null);
  }
};

DefaultRelay.prototype.addClient = function(clientInfo, cb) {
  debug.relay('DefaultRelay:addClient');

  clientInfo._internalState = this.CONNECTING;
  clientInfo._ping = new Date().getTime();

  this.clientsByConnId[clientInfo.connId] = clientInfo;
  if(!this.clientsByConnId[clientInfo.connId].sendQueue) {
    this.clientsByConnId[clientInfo.connId].sendQueue = [];
  }
  if(!this.clientsByConnId[clientInfo.connId].receiveQueue) {
    this.clientsByConnId[clientInfo.connId].receiveQueue = [];
  }

  cb(null, null);
};

DefaultRelay.prototype.removeClient = function(clientInfo) {
  debug.relay('DefaultRelay:removeClient');
  if(this.clientsByConnId[clientInfo.connId]) {
    delete this.clientsByConnId[clientInfo.connId];
  }
};

DefaultRelay.prototype.attachToConnection = function(pollConnection, cb) {
  debug.relay('DefaultRelay:attachToConnection');
  var connId = pollConnection.connId;

  pollConnection.readyState = this.CONNECTING;

  this.getClient(connId, function(err, clientInfo) {
    if(clientInfo) {

      // This is mainly in place to ensure seamless prototyping for other relays
      // E.g. the redis relay doesn't add the client locally on poll-start
      // The following ensures, that doesn't create problems
      if(!this.clientsByConnId[clientInfo.connId]) {
        this.clientsByConnId[clientInfo.connId] = clientInfo;
      }

      this.clientsByConnId[clientInfo.connId]._internalState = this.CONNECTING;

      pollConnection.relay = this;

      pollConnection.send = this.send.bind(this, clientInfo.connId);

      this.clientsByConnId[clientInfo.connId].sendMessage =
        pollConnection.sendMessage.bind(pollConnection);

      this.clientsByConnId[clientInfo.connId].receive =
        pollConnection.receiveMessage.bind(pollConnection);

      pollConnection.readyState = pollConnection.OPEN;

      this.clientsByConnId[clientInfo.connId]._internalState = this.OPEN;

      this.checkForMessages(pollConnection.connId);

      cb(null);

    } else {
      pollConnection.readyState = pollConnection.CLOSING;
      this.clientsByConnId[connId]._internalState = this.CLOSING;

      if(pollConnection && pollConnection.sendBadRequest) {
        pollConnection.sendBadRequest();
      }
      cb(new Error('Unknown connection'));
    }


  }.bind(this));
};


// SERVER -> BROWSER
DefaultRelay.prototype.send = function(connId, message) {
  // This should assume only 1 message at a time, not an array
  debug.todo('make sure there is a connection to the client');
  debug.msgOut('DefaultRelay:sendMessage to connId: '+connId);
  debug.msgOut(message);
  // Assumes that we don't need to know anything about the actual message
  this.clientsByConnId[connId].sendQueue.push(message);
  setImmediate(this.checkForMessages.bind(this, connId));
};

// SERVER BASED MESSAGE (CLIENT REQUEST) -> SERVER
DefaultRelay.prototype.receiveMessages = function(connId, messages) {
  debug.todo('Messages needs to be an array in the future!');
  debug.msgIn('DefaultRelay:receiveMessage');
  debug.msgIn(messages);
  // Assumes that we don't need to know anything about the actual message
  var messages = JSON.parse(messages);
  for(var i in messages) {
    this.clientsByConnId[connId].receiveQueue.push(messages[i]);
  }
  setImmediate(this.checkForMessages.bind(this, connId));
};

DefaultRelay.prototype.sendBadRequest = function(response) {
  debug.relay('DefaultRelay:sendBadRequest');
  response.writeHead(400, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  });
  response.end('Bad Request');
};


DefaultRelay.prototype.checkForMessages = function(connId) {
  debug.relay('DefaultRelay:checkForMessages');
  if(connId && this.clientsByConnId[connId]) {

    if(this.clientsByConnId[connId].sendMessage &&
       this.clientsByConnId[connId].sendQueue &&
       this.clientsByConnId[connId].sendQueue.length &&
       this.clientsByConnId[connId]._internalState == this.OPEN)
    {
      var messages = this.clientsByConnId[connId].sendQueue.splice(0);
      this.clientsByConnId[connId]._internalState = this.SENDING;
      this.clientsByConnId[connId].sendMessage(JSON.stringify(messages), function(err) {
        if(err) {
          for(var i=messages.length ; i > 0 ; i--) {
            this.clientsByConnId[connId].sendQueue.unshift(messages[(i-1)]);
          }
        }
      });
    }

    if(this.clientsByConnId[connId].receive &&
       this.clientsByConnId[connId].receiveQueue &&
       this.clientsByConnId[connId].receiveQueue.length)
    {
      var messages = this.clientsByConnId[connId].receiveQueue.splice(0);
      for(var i in messages) {
        this.clientsByConnId[connId].receive(messages[i]);
      }
    }
  }
};


DefaultRelay.prototype.checkAllForMessages = function() {
  debug.relay('DefaultRelay:checkAllForMessages');
  // Is there any way to make this connections based?
  // Probably not, as this is not only for messages
  for(var connId in this.clientsByConnId) {
    this.checkForMessages(connId);
  }
};

// This will be called automatically
// The interval can be configure through the server
DefaultRelay.prototype.cleanup = function() {
  debug.relay('DefaultRelay:cleanup');

  var checkTime = new Date().getTime();

  var counter = 0;
  for(var i in this.clientsByConnId) {
    if((this.clientsByConnId[i]._ping + (this.cleanupInterval * 1000)) < checkTime) {
      delete this.clientsByConnId[i];
    }
    else counter++;
  }
};









// Request should have close, end, finish and error
// End (readable): This event fires when there will be no more data to read.
//                 The event will not fire unless the data is completely consumed
// Finish (writable): all data has been flushed to the underlying system
// Close (readable?): Emitted when the underlying resource (for example, the
//                    backing file descriptor) has been closed.
//                    Not all streams will emit this.
//
// So... Normal language (when using http.Server || http.createServer) :
// These 2 WILL happen under normal circumstances
// That includes broken connections
// req.end
// res.finish
//
// When a connection is broken prematurely, these will happen FIRST
// req.close
// res.close
//
// Some thoughts:
// response.finished: true | false - can it be used for something???
// res.socket._events.timeout - useful in any way?
// What about the other socket and connection events?
// res.socket.destroyed: true | false - this REALLY might be useful!
// res.socket.bytesRead: 369 - and this?
// res.socket._bytesDispatched: 151 - or this?
// res.connection._connecting: true | false
// res.connection.ended: true | false
//
// res.connection._events: finish, _socketEnd, drain, timeout, error, close
// res.socket._events: finish, _socketEnd, drain, timeout, error, close
//
// res.connection._writableState.ending: true | false
// res.connection._writableState.ended: true | false
// res.connection._writableState.finished: true | false
// res.connection.writable: true | false
// res.connection.destroyed: true | false
//
// O.k... So there's a lot of similar info between res.connection and res.socket
//
// The conclusion must be:
// If req.close and res.close comes, it seems it will be the first event.
// Otherwise res.finish and req.end will come first (they will come no matter what)
