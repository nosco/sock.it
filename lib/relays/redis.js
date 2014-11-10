// When we are to make the broadcast and we want to do it based on host,
// we should be able to just prototype some stuff on this one.
// The same should be the case, when we want to do user specific messaging
//
// It might be worth thinking about, how others has done "room" based messaging.
//
// Thought on messages marked as "in progress":
// For now we can just let them expire, if the sending fails - that would be
// what websockets does AND it eases message fetching from "unmarked" list, as
// the failed messages will just die and expire in their own list
//
// WOULD IT BE A GOOD IDEA TO LET OTHER RELAYS INHERIT OR PROTOTYPE ON THE
// DEFAULT RELAY?

var redis = require('redis');
var async = require('async');
var util = require('util');
var events = require('events');
var DefaultRelay = require('./default');

var RedisRelay = function(config) {
  if(RedisRelay.prototype._singleton) {
    return RedisRelay.prototype._singleton;
  }
  RedisRelay.prototype._singleton = this;

  DefaultRelay.call(this);

  this.pubSubClient = this.pubSubClient || redis.createClient();
  this.redisClient  = this.redisClient  || redis.createClient();
};
util.inherits(RedisRelay, DefaultRelay);
module.exports = RedisRelay;

RedisRelay.prototype.lookupClientInfo = function(connId, cb) {
  this.redisClient.get('sock.it:client::'+connId, function(err, res) {
    if(res) res = JSON.parse(res);
    cb(null, res);
  });
};


RedisRelay.prototype.addClient = function(clientInfo, cb) {
  debug.todo('Make sure expiration works with redis.set in redis relay');
  debug.conn('addClient');
  this.redisClient.set('sock.it:client::'+clientInfo.connId,
                        JSON.stringify(clientInfo),
                        this.cleanupInterval, function(err, res) {
    cb(err, clientInfo);
  });
};


RedisRelay.prototype.removeClient = function(clientInfo) {
  debug.conn('removeClient');
  if(this.clientsByConnId[clientInfo.connId]) {
    this.redisClient.del('sock.it:client::'+clientInfo.connId);
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
RedisRelay.prototype.sendMessage = function(connId, message) {
  debug.todo('@todo make sure there is a connection to the client');
  debug.msgOut('sendMessage to connId: '+connId);
  debug.msgOut(message);
  // Assumes that we don't need to know anything about the actual message
  this.redisClient.rpush('sock.it:response::'+connId, message, function() {
    debug.msgOut('Add message to browser to redis:');
    debug.msgOut(arguments);
    this.senderClient.publish('sock.it:response', connId, function() {});
    // Check and send messages, right? YEP!
  }.bind(this));
  // Check and send messages, right?
};


// SERVER BASED MESSAGE (CLIENT REQUEST) -> SERVER
RedisRelay.prototype.receiveMessage = function(connId, message) {
  debug.msgIn('receiveMessage');
  debug.msgIn(message);
  // Assumes that we don't need to know anything about the actual message
  this.redisClient.rpush('sock.it:request::'+connId, message, function() {
    this.senderClient.publish('sock.it:request', connId, function() {});
    // Check and send messages, right? YEP!
  }.bind(this));
};

// // CLIENT REQUEST -> SERVER
// RedisRelay.prototype.receiveMessages = function(clientInfo, messages) {
//   for(var i in messages) this.receiveMessage(clientInfo, messages[i]);
//   // Check and send messages, right?
// };


RedisRelay.prototype.sendBadRequest = function(response) {
  response.writeHead(400, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  });
  response.end('Bad Request');
};


RedisRelay.prototype.sendResponse = function(clientInfo, message) {
  this.redisClient.rpush('sock.it:response::'+clientInfo.connId, message, function() {
    this.senderClient.publish('sock.it:response', clientInfo.connId, function() {});
  }.bind(this));
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



RedisRelay.prototype.handleMessage = function(request, response, clientInfo, pollClient) {
  // Set the clientInfo to update the expire time
  this.redisClient.set('sock.it:client::'+clientInfo.connId,
                        JSON.stringify(clientInfo),
                        this.cleanupInterval, function(err, res) {});

  if(request.method == 'POST') {
    var body = '';

    request.on('data', function(data) {
      body += data;
    });

    request.on('end', function () {
      response.end();
      this.receiveRequest(clientInfo);
      // this.checkForMessages(clientInfo);

      // This is probably not necessary as the cleanup should do the job
      // It just adds a bit of unnecessary overhead
      // delete this.clientsByConnId[clientInfo.connId];
    }.bind(this));

  } else {
    this.sendBadRequest(response);
  }



  pollClient.send = this.handleMessage.bind(this, clientInfo);


  pollClient.send = this.handleMessage.bind(this, clientInfo);
};

RedisRelay.prototype.handlePollConnection = function(request, response, clientInfo, pollClient) {
  debug.todo('Remember to ensure that messages that fails to be delivered, should go back into Redis in handlePollConnection in redis.js');
  // This is actually just to make sure, thet expiration is reset
  // Do we need the dummy callback func?
  this.redisClient.set('sock.it:client::'+clientInfo.connId,
                        JSON.stringify(clientInfo),
                        this.cleanupInterval, function(err, res) {});

  this.clientsByConnId[clientInfo.connId].response = response;

  pollClient.send = this.receiveMessage.bind(this, clientInfo);

  // pollClient.send = this.handleMessage.bind(this, clientInfo);

  // pollClient.response.writeHead(200, {
  //   'Content-Type': 'text/plain; charset=utf-8',
  //   'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  // }); // No JSON for IE8?..

  // Start listening for events

  // The most important thing about this, is that the local reference gets removed,
  // once the connection is no longer "writable" and thereby not this processes responsibility
  response.on('close', function() {
    // If this is emitted, it seems it will come before response.finish and request.end
    // It should only happen on a connection that breaks
    // So use it to detect when errors happen as error doesn't get fired at all
  });

  response.on('finish', function() {
    // This WILL happen under normal circumstances and when a connection breaks
    // This event fires when there will be no more data to read
    // Note: the connection is not completely done and torn down at this point
    // This will be used, to know when to remove local poll references
  });


  Check for messages and start listening for pub/subs, if there is none now


  And then something like listening for request.end or something, to handle
  stuff like premature disconnections



  // Do we need this?
  // this.sendState = this.OPENING;
  // this.sendState = this.WAITING;
  // this.emit('connection', this);
};

// BACKEND -> BACKEND
RedisRelay.prototype.receiveRequest = function(clientInfo, message) {
  this.redisClient.rpush('sock.it:request::'+clientInfo.connId, message, function() {
    this.senderClient.publish('sock.it:request', clientInfo.connId, function() {});
  }.bind(this));
};

// SERVER -> BACKEND
RedisRelay.prototype.sendResponse = function(clientInfo, message) {
  this.redisClient.rpush('sock.it:response::'+clientInfo.connId, message, function() {
    this.senderClient.publish('sock.it:response', clientInfo.connId, function() {});
  }.bind(this));
};


// This will be called automatically
// The interval can be configure through the server
RedisRelay.prototype.cleanup = function() {
  console.log('Redis relay cleanup script');
};








RedisRelay.prototype.listenForMessages = function(request, response, cb) {
  this.pubSubClient.on('message', function(channel, connId) {
    // console.log('got message');
    this.findAndSendMessage(connId);
  }.bind(this));
  this.pubSubClient.subscribe('sock.it:messages');
};

RedisRelay.prototype.checkForMessages = function(pollClient) {
  var connId = pollClient.client.connId;
  this.findAndSendMessage(connId);
};

RedisRelay.prototype.findAndSendMessage = function(connId) {
  if(this.clientsByConnId[connId] && this.clientsByConnId[connId].sendState === this.clientsByConnId[connId].WAITING) {

    this.redisClient.lrange('sock.it:messages::'+connId, 0, 1000, function(err, res) {
      if(err) {
        // console.log('THERE WAS AN ERROR!')
        // console.log(err);
      } else if(!err && res.length) {
        // console.log('FOUND SOME');
        console.log('GOING TO LTRIM '+res.length);
        this.redisClient.ltrim('sock.it:messages::'+connId, res.length, 1000, function() {
          console.log('LTRIM RETURNS:');
          console.log(arguments);
        });
        for(var i in res) {
console.log('MESSAGE:');
console.log(res[i]);
          this.clientsByConnId[connId].messageQueue.push(res[i]);
        }

        this.clientsByConnId[connId].sendState = this.SENDING;
        this.clientsByConnId[connId].response.end(JSON.stringify(this.clientsByConnId[connId].messageQueue));
        this.clientsByConnId[connId].messageQueue = [];
        this.clientsByConnId[connId].sendState = this.CLOSING;


        // this.clientsByConnId[connId].checkAndSendMessages(function(success) {
        //   // console.log(success);
        //   if(!success) {
        //     // console.log('NO SUCCESS');
        //     for(var n in this.clientsByConnId[connId].messageQueue) {
        //       var msg = this.clientsByConnId[connId].messageQueue[n];
        //       this.redisClient.lpush('sock.it:messages::'+connId, msg, function() {});
        //     }
        //   }
        // }.bind(this));

      } else {
        // console.log('RETRYING IN A BIT');
      }
    }.bind(this));
  }
};


RedisRelay.prototype.handleRequest = function(request, response, cb) {
  var connId = null;

  async.waterfall([
    function lookupClientInfo(next) {
      if(!connId) return next(null, null);
      this.getClientInfo(connId, next);
    }.bind(this),

    function lookupPollClient(clientInfo, next) {
      if(clientInfo && this.clientsByConnId[clientInfo.connId]) {
        next(null, clientInfo, this.clientsByConnId[clientInfo.connId]);
      } else {
        next(null, clientInfo, null);
      }
    }.bind(this),

    function determineAction(clientInfo, pollClient, next) {
      if(!clientInfo && (request.url.indexOf(this.path) !== -1)) {
        // console.log('RELAY: poll-start');
        next('poll-start', clientInfo, null);

      } else if(request.url === this.path + 'poll-start') {
        // console.log('RELAY: poll-start');
        next('poll-start', clientInfo, pollClient);

      } else if(request.url === this.path + 'poll') {
        // console.log('RELAY: poll');
        next('poll', clientInfo, pollClient);

      } else if(request.url === this.path + 'poll-msg') {
        // console.log('RELAY: poll-msg');

        this.handleMessage(clientInfo, request, response);
        next('poll-msg', clientInfo, null);

      } else {
        next(null, null, null);
      }
    }.bind(this)
  ], cb);
}


RedisRelay.prototype.handleMessage = function(clientInfo, message) {
  this.redisClient.rpush('sock.it:messages::'+clientInfo.connId, message, function() {
    this.senderClient.publish('sock.it:messages', clientInfo.connId, function() {});
  }.bind(this));
};

RedisRelay.prototype.getClientInfo = function(connId, cb) {
  this.redisClient.get('sock.it:client::'+connId, function(err, res) {
    if(res) res = JSON.parse(res);
    cb(err, res);
  });
};

RedisRelay.prototype.createClient = function(clientInfo, cb) {
  clientInfo.connId = clientInfo.connId || this._generateId();
  clientInfo.lastActivity = new Date();
  // var pollClient = this.clientsByConnId[clientInfo.connId];
  this.redisClient.set('sock.it:client::'+clientInfo.connId, JSON.stringify(clientInfo), function(err, res) {
    cb(err, clientInfo);
  });
};

RedisRelay.prototype.addPollClient = function(pollClient) {
  this.clientsByConnId[pollClient.client.connId] = pollClient;
  pollClient.on('connection', this.checkForMessages.bind(this));
  // pollClient.on('close', function() {
  //   console.log('deleting pollClient');
  //   delete this.clientsByConnId[pollClient.client.connId];
  //   console.log(this.clientsByConnId);
  // }.bind(this));
  this.cleanupPollClients();
}


// Check out that this actually holds true!...
RedisRelay.prototype.cleanupPollClients = function() {
  var now = new Date();
  // var minAge = now.setTime(now.getTime() + (3600 * 1000)); // 1 hour
  var minAge = now.setTime(now.getTime() - (60 * 1000)); // 60 sec

  for(var connId in this.clientsByConnId) {
    if(this.clientsByConnId[connId].lastActivity < minAge || this.clientsByConnId[connId].sendState === this.clientsByConnId[connId].CLOSING) {
      console.log('removing one');
      this.clientsByConnId[connId].sendState = this.clientsByConnId[connId].CLOSING;
      this.clientsByConnId[connId].emit('close', this.clientsByConnId[connId]);
      delete this.clientsByConnId[connId];
    }
  }

  console.log(require('util').inspect(this.clientsByConnId, {depth:0}));
};


