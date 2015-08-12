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

// @TODO
// - The relay(? somebody!) needs to listen for pub/sub messages

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

  DefaultRelay.apply(this, arguments);
  debug.relay('RedisRelay:constructor');

  var port = ~~process.env.REDIS_PORT || 6379;
  var host = process.env.REDIS_HOST || '127.0.0.1';
  var options = {};
  this.pubSubClient = config.pubSubClient || redis.createClient(port, host, options);
  this.redisClient  = config.redisClient  || redis.createClient(port, host, options);

  this.tmpFixForCrashesAndRestarts();

  this.listenForPubSub();
};
util.inherits(RedisRelay, DefaultRelay);
module.exports = RedisRelay;

RedisRelay.prototype.tmpFixForCrashesAndRestarts = function() {
  // @todo update the clientInfo with a PID and check if that is running
  this.redisClient.flushall();
};

RedisRelay.prototype.listenForPubSub = function() {
  debug.relay('RedisRelay:listenForPubSub');

  this.pubSubClient.on('message', function(channel, connId) {
    this.emit(channel+'::'+connId);
  }.bind(this));

  this.pubSubClient.subscribe('sock.it:sendQueue');
  this.pubSubClient.subscribe('sock.it:receiveQueue');
};

RedisRelay.prototype.getClient = function(connId, cb) {
  this.redisClient.get('sock.it:client::'+connId, function(err, res) {
    if(res) {
      this.redisClient.expire('sock.it:client::'+connId, this.cleanupInterval);
      res = JSON.parse(res);
    }
    cb(null, res);
  }.bind(this));
};


RedisRelay.prototype.saveClient = function(clientInfo, cb) {
  debug.relay('RedisRelay:saveClient');
  cb = cb || function() {};

  this.redisClient.setex('sock.it:client::'+clientInfo.connId,
                          this.cleanupInterval,
                          JSON.stringify(clientInfo),
                          function(err, res) {
    if(err) debug.err(err);

    cb(err, clientInfo);
  });
};


RedisRelay.prototype.removeClient = function(connId) {
  // This should somehow trigger a disconnect/close on other processes
  debug.relay('RedisRelay:removeClient');
  this.emit('sock.it:clientClose::'+connId);
  this.redisClient.del('sock.it:client::'+connId);
};

// ON attachToConnection, SHOULD WE STORE THE OBJECT, IN ORDER TO KNOW, WHICH POLL
// CONNECTIONS IS LOCAL TO THIS PROCESS???
// BASICALLY WE SHOULD CHECK FOR MESSAGES FOR THE NEW CONNECTION, RIGHT AWAY - AND
// OTHERWISE START LISTENING FOR PUB/SUB MESSAGES...
// MAYBE IT WOULD BE SMARTER TO JUST LET THE RELAY CONTROL THE connectionsByConnId?
// THIS COULD BASICALLY BE DONE, JUST BY LETTING poll.js:handlePollRequest call
// relay.attachToConnection, EACH TIME, INSTEAD OF ONLY IF IT DOES NOT KNOW ABOUT IT.

// SERVER -> BROWSER
// This is what will actually be called, when calling "send" on the emitted connection
// This is the final "result" from a request gotten from the browser
// @todo maybe check if we have the connection in this thread - use it if we have
RedisRelay.prototype.send = function(connId, message) {
  debug.msgOut('RedisRelay:sendMessage to connId: '+connId);
  debug.msgOut(message);

  this.redisClient.rpush('sock.it:sendQueue::'+connId, message, function(err, res) {
    debug.msgOut('RedisRelay:Add message to browser to redis');
    this.redisClient.publish('sock.it:sendQueue', connId, function() {});
  }.bind(this));
};

// Same as above, this is just for when messages fails
// The messages needs to be put first in the list
RedisRelay.prototype.reSend = function(connId, messages) {
  debug.msgOut('RedisRelay:reSend to connId: '+connId);
  debug.msgOut(messages);

  var count = 0;
  for(var i in messages) {
    this.redisClient.lpush('sock.it:sendQueue::'+connId, messages[i], function(err, res) {
      debug.msgIn('RedisRelay:Re add message to browser to redis');
      count++;
      if(count == messages.length) {
        this.redisClient.publish('sock.it:sendQueue', connId, function() {});
      }
    }.bind(this));
  }
};

// SERVER BASED MESSAGE (CLIENT REQUEST) -> SERVER
// This is the request from the browser
RedisRelay.prototype.receiveMessages = function(connId, messages) {
  debug.msgIn('DefaultRelay:receiveMessage');
  debug.msgIn(messages);
  // Assumes that we don't need to know anything about the actual message
  var messages = JSON.parse(messages);
  var count = 0;
  for(var i in messages) {
    this.redisClient.rpush('sock.it:receiveQueue::'+connId, messages[i], function(err, res) {
      debug.msgIn('RedisRelay:Add message to server to redis');
      count++;
      if(count == messages.length) {
        this.redisClient.publish('sock.it:receiveQueue', connId, function() {});
      }
    }.bind(this));
  }
  // @todo This is probably not necessary any more
  // setImmediate(this.checkForMessages.bind(this, connId));
};


// @todo We probably need a better way of ensuring it's the right messages, that
// are being removed from the processing queue
// It should probably be way different, as this needs to listen for messages
// to known clients
RedisRelay.prototype.getSendMessages = function(connId, cb) {
  debug.relay('RedisRelay:checkForSendMessages');
  if(!cb) throw new Error('A callback is needed in RedisRelay:getSendMessages');

  if(connId && cb) {
    this.redisClient.multi()
      .lrange('sock.it:sendQueue::'+connId, 0, -1)
      .ltrim('sock.it:sendQueue::'+connId, 1, 0)
      .exec(function(err, res) {
        if(!err && res[0] && res[0].length) {
          cb(null, res[0]);
        } else {
          cb(null, null);
        }
    }.bind(this));

  } else {
    cb(new Error('Missing connId or cb'));
  }
};

RedisRelay.prototype.getReceiveMessages = function(connId, cb) {
  debug.relay('RedisRelay:checkForReceiveMessages');
  if(!cb) throw new Error('A callback is needed in RedisRelay:getReceiveMessages');

  if(connId && cb) {
    this.redisClient.multi()
      .lrange('sock.it:receiveQueue::'+connId, 0, -1)
      .ltrim('sock.it:receiveQueue::'+connId, 1, 0)
      .exec(function(err, res) {
        if(!err && res[0] && res[0].length) {
          cb(null, res[0]);
        } else {
          cb(null, null);
        }
    }.bind(this));

  } else {
    cb(new Error('Missing connId or cb'));
  }
};


RedisRelay.prototype.cleanup = function() {
  DefaultRelay.prototype.cleanup.call(this);

  debug.relay('RedisRelay:cleanup');

  this.redisClient.keys('sock.it:*Queue::*', function(err, res) {
    if(res) {
      for(var i in res) {
        var connId = res[i].replace(/sock.it:(send|receive)Queue::/i, '');
        this.redisClient.get('sock.it:client::'+connId, function(err, res2) {
          if(!res2) {
            this.redisClient.del('sock.it:sendQueue::'+connId);
            this.redisClient.del('sock.it:receiveQueue::'+connId);
          }
        }.bind(this));
      }
    }
  }.bind(this));
};
