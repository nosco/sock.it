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
  if(connId && this.clientsByConnId[connId]) {
    this.clientsByConnId[connId]._ping = new Date().getTime();

    cb(null, this.clientsByConnId[connId]);
  } else {
    cb(null, null);
  }
};

DefaultRelay.prototype.saveClient = function(clientInfo, cb) {
  debug.relay('DefaultRelay:saveClient');
  cb = cb || function() {};

  clientInfo._ping = new Date().getTime();

  this.clientsByConnId[clientInfo.connId] = clientInfo;
  if(!this.clientsByConnId[clientInfo.connId].sendQueue) {
    this.clientsByConnId[clientInfo.connId].sendQueue = [];
  }
  if(!this.clientsByConnId[clientInfo.connId].receiveQueue) {
    this.clientsByConnId[clientInfo.connId].receiveQueue = [];
  }

  cb(null, clientInfo);
};

DefaultRelay.prototype.removeClient = function(connId) {
  // This should somehow trigger a disconnect/close on other processes
  debug.relay('DefaultRelay:removeClient');
  if(this.clientsByConnId[connId]) {
    this.emit('sock.it:clientClose::'+connId);
    delete this.clientsByConnId[connId];
  }
};


DefaultRelay.prototype.handleMessageRequest = function(request, response, clientInfo) {
  var body = '';

  // close events ONLY happens on broken connections - I haven't seen an error event yet...
  response.on('close', function() {
    debug.todo('What should be done here? If anything at all...');
    // @todo should we do anything here?
    // It seems ALL messages comes in, so apparently no problems?
    // It would be the browsers responsibility to detect an incorrect send and
    // retry that message (if copying what WebSocket does)
  }.bind(this));

  request.on('data', function(data) { body += data; });

  request.on('end', function () {
    this.receiveMessages(clientInfo.connId, body);
    response.end();
  }.bind(this));
};


// SERVER -> BROWSER
DefaultRelay.prototype.send = function(connId, message) {
  // This should assume only 1 message at a time, not an array
  debug.msgOut('DefaultRelay:send to connId: '+connId);
  debug.msgOut(message);

  this.clientsByConnId[connId].sendQueue.push(message);
  console.log('EMIT: sock.it:sendQueue::'+connId);
  this.emit('sock.it:sendQueue::'+connId);
};

// Same as above, this is just for when messages fails
// The messages needs to be put first in the list
DefaultRelay.prototype.reSend = function(connId, messages) {
  // This should assume only 1 message at a time, not an array
  debug.msgOut('DefaultRelay:reSend to connId: '+connId);
  debug.msgOut(message);

  this.clientsByConnId[connId].sendQueue.unshift(message);
  this.emit('sock.it:sendQueue::'+connId);
};

// SERVER BASED MESSAGE (CLIENT REQUEST) -> SERVER
DefaultRelay.prototype.receiveMessages = function(connId, messages) {
  debug.msgIn('DefaultRelay:receiveMessage');
  debug.msgIn(messages);

  var messages = JSON.parse(messages);
  for(var i in messages) {
    this.clientsByConnId[connId].receiveQueue.push(messages[i]);
  }
  this.emit('sock.it:receiveQueue::'+connId);
};

DefaultRelay.prototype.sendBadRequest = function(response) {
  debug.relay('DefaultRelay:sendBadRequest');
  response.writeHead(400, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  });
  response.end('Bad Request');
};


DefaultRelay.prototype.getSendMessages = function(connId, cb) {
  debug.relay('DefaultRelay:checkForSendMessages');
  if(!cb) throw new Error('A callback is needed in DefaultRelay:getSendMessages');

  if(connId && this.clientsByConnId[connId]) {

    if(this.clientsByConnId[connId].sendQueue &&
       this.clientsByConnId[connId].sendQueue.length)
    {
      cb(null, this.clientsByConnId[connId].sendQueue.splice(0));

    } else {
      cb(null, null);
    }

  } else {
    cb(new Error('Missing connId or cb'));
  }
};

DefaultRelay.prototype.getReceiveMessages = function(connId, cb) {
  debug.relay('DefaultRelay:checkForReceiveMessages');
  if(!cb) throw new Error('A callback is needed in DefaultRelay:getReceiveMessages');

  if(connId && this.clientsByConnId[connId]) {

    if(this.clientsByConnId[connId].receiveQueue &&
       this.clientsByConnId[connId].receiveQueue.length)
    {
      cb(null, this.clientsByConnId[connId].receiveQueue.splice(0));

    } else {
      cb(null, null);
    }

  } else {
    cb(new Error('Missing connId or cb'));
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
