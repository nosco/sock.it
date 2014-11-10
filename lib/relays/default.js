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
};
util.inherits(DefaultRelay, events.EventEmitter);
module.exports = DefaultRelay;

DefaultRelay.prototype.lookupClientInfo = function(connId, cb) {
  if(this.clientsByConnId[connId]) {
    cb(null, this.clientsByConnId[connId]);
  } else {
    cb(null, null);
  }
};

DefaultRelay.prototype.addClient = function(clientInfo, cb) {
  debug.conn('addClient');
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
  debug.conn('removeClient');
  if(this.clientsByConnId[clientInfo.connId]) {
    delete this.clientsByConnId[clientInfo.connId];
  }
};

DefaultRelay.prototype.attachToConnection = function(pollConnection, cb) {
  debug.conn('attachToConnection');
  var connId = pollConnection.connId;

  this.lookupClientInfo(connId, function(err, clientInfo) {
    if(clientInfo) {

      pollConnection.send = this.sendMessage.bind(this, connId);
      // @todo check if there is messages for this conn
      this.clientsByConnId[connId].send =
        pollConnection.sendMessage.bind(pollConnection);

      this.clientsByConnId[connId].receive =
        pollConnection.receiveMessage.bind(pollConnection);
// @todo TOGETHER WITH checkForMessages THIS SEEMS TO CREATE A RECURSIVE PATTERN!
// client.receive == relay.receiveMessage
// relay.reciveMessage calls relay.checkForMessages
// relay.checkForMessages calls client.receive (which is relay.receiveMessages)
// Is this wrong or?????
      cb(null);

    } else {
      if(pollConnection && pollConnection.sendBadRequest) {
        pollConnection.sendBadRequest();
      }
      cb(new Error('Unknown connection'));
    }
  }.bind(this));
};


// SERVER -> BROWSER
DefaultRelay.prototype.sendMessage = function(connId, message) {
  debug.todo('@todo make sure there is a connection to the client');
  debug.msgOut('sendMessage to connId: '+connId);
  debug.msgOut(message);
  // Assumes that we don't need to know anything about the actual message
  this.clientsByConnId[connId].sendQueue.push(message);
  this.checkForMessages(connId);
  // Check and send messages, right?
};

// SERVER -> BROWSER
// @TODO This should not be done in this way! It should be an array and the
// browser needs to assume it IS an array
// DefaultRelay.prototype.sendMessages = function(connId, messages) {
//   for(var i in messages) this.sendMessage(connId, messages[i]);
//   // Check and send messages, right?
// };

// SERVER BASED MESSAGE (CLIENT REQUEST) -> SERVER
DefaultRelay.prototype.receiveMessage = function(connId, message) {
  debug.msgIn('receiveMessage');
  debug.msgIn(message);
  // Assumes that we don't need to know anything about the actual message
  this.clientsByConnId[connId].receiveQueue.push(message);
  this.checkForMessages(connId);

  // Assumes that we don't need to know anything about the actual message
  //this.clientsByConnId[clientInfo.connId].messageQueue.push(message);
  // Check and send messages, right?
};

// // CLIENT REQUEST -> SERVER
// DefaultRelay.prototype.receiveMessages = function(clientInfo, messages) {
//   for(var i in messages) this.receiveMessage(clientInfo, messages[i]);
//   // Check and send messages, right?
// };

DefaultRelay.prototype.sendBadRequest = function(response) {
  response.writeHead(400, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  });
  response.end('Bad Request');
};


DefaultRelay.prototype.checkForMessages = function(connId) {
  if(connId && this.clientsByConnId[connId]) {

    if(this.clientsByConnId[connId].send &&
       this.clientsByConnId[connId].sendQueue &&
       this.clientsByConnId[connId].sendQueue.length)
    {
      var messages = this.clientsByConnId[connId].sendQueue.splice(0);
      this.clientsByConnId[connId].send(JSON.stringify(messages));
    }

    if(this.clientsByConnId[connId].receive &&
       this.clientsByConnId[connId].receiveQueue &&
       this.clientsByConnId[connId].receiveQueue.length)
    {
      var messages = this.clientsByConnId[connId].receiveQueue.splice(0);
      for(var i in messages) {
        this.clientsByConnId[connId].receive(messages[i]);
      }
      // this.clientsByConnId[connId].receive(JSON.stringify(messages));
    }
  }
};


DefaultRelay.prototype.checkAllForMessages = function() {
  for(var connId in this.clientsByConnId) {
    this.checkForMessages(connId);
  }
};



// This will be called automatically
// The interval can be configure through the server
DefaultRelay.prototype.cleanup = function() {
  debug.conn('Default relay cleanup script');
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
