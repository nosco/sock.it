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

  this.pubSubClient = this.pubSubClient || redis.createClient();
  this.redisClient  = this.redisClient  || redis.createClient();
  this.listenForPubSub();


  debug.relay('RedisRelay:constructor');
};
util.inherits(RedisRelay, DefaultRelay);
module.exports = RedisRelay;


RedisRelay.prototype.listenForPubSub = function() {
  // debug.relay('RedisRelay:listenForPubSub');

  this.pubSubClient.on('message', function(channel, connId) {
    this.checkForMessages(connId);
  }.bind(this));

  this.pubSubClient.subscribe('sock.it:sendQueue');
  this.pubSubClient.subscribe('sock.it:receiveQueue');

  // Start to listen
  // When message arrives, call checkForMessages with connId

  // What should happen here?
  // this.checkAllForMessages();
  // If we use checkAllForMessages, we need to overwrite it, as it doesn't do
  // what we need here....
};

RedisRelay.prototype.getClient = function(connId, cb) {
  console.log('getClient:res');
  this.redisClient.get('sock.it:client::'+connId, function(err, res) {
    console.log('getClient:res done');
    console.log(res);
    if(res) {
      console.log('Found client! Updating expire');
      this.redisClient.expire('sock.it:client::'+connId, this.cleanupInterval);
      res = JSON.parse(res);
    }
    cb(null, res);
  }.bind(this));
};


RedisRelay.prototype.addClient = function(clientInfo, cb) {
  debug.todo('Make sure expiration works with redis.set in redis relay');
  debug.relay('RedisRelay:addClient');
  debug.relay(this.cleanupInterval);

  clientInfo._internalState = this.CONNECTING;

  this.redisClient.setex('sock.it:client::'+clientInfo.connId,
                          this.cleanupInterval,
                          JSON.stringify(clientInfo),
                          function(err, res) {
    if(err) debug.err(err);
    cb(err, clientInfo);
  });
};


RedisRelay.prototype.removeClient = function(clientInfo) {
  debug.relay('RedisRelay:removeClient');
  if(this.clientsByConnId[clientInfo.connId]) {
    this.redisClient.del('sock.it:client::'+clientInfo.connId);
  }
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
RedisRelay.prototype.sendMessage = function(connId, message) {
  debug.msgOut('RedisRelay:sendMessage to connId: '+connId);
  debug.msgOut(message);
  // Assumes that we don't need to know anything about the actual message
// console.log('SEND MESSAGE:');
// console.log(message);
// console.log('PUTTING MESSAGE INTO SEND QUEUE: '+JSON.parse(message).messageId);
  this.redisClient.rpush('sock.it:sendQueue::'+connId, message, function(err, total) {
    debug.msgOut('RedisRelay:Add message to browser to redis:');
    debug.msgOut('total: '+total);
    this.redisClient.publish('sock.it:sendQueue', connId, function() {});
  }.bind(this));
};


// SERVER BASED MESSAGE (CLIENT REQUEST) -> SERVER
// This is the request from the browser
RedisRelay.prototype.receiveMessages = function(connId, messages) {
  debug.todo('Messages needs to be an array in the future!');
  debug.msgIn('RedisRelay:receiveMessage');
  debug.msgIn(messages);
// console.log('PUTTING MESSAGE INTO RECEIVE QUEUE: '+JSON.parse(message).messageId);
  // Assumes that we don't need to know anything about the actual message

  var messages = JSON.parse(messages);
  var count = 0;
  for(var i in messages) {
    this.redisClient.rpush('sock.it:receiveQueue::'+connId, messages[i], function(err, total) {
      count++;
      debug.msgIn('RedisRelay:Add message to server to redis:');
      debug.msgIn('total: '+total);

      if(count == messages.length) {
        // console.log('Send '+count+' messages');
        this.redisClient.publish('sock.it:receiveQueue', connId, function() {});
      }
    }.bind(this));
  }
};

// // CLIENT REQUEST -> SERVER
// RedisRelay.prototype.receiveMessages = function(clientInfo, messages) {
//   for(var i in messages) this.receiveMessage(clientInfo, messages[i]);
//   // Check and send messages, right?
// };

// IT'S SEEMS TO BE ALL DOWN TO THE REDIS checkForMessages NOW!!!

// @todo We probably need a better way of ensuring it's the right messages, that
// are being removed from the processing queue
// It should probably be way different, as this needs to listen for messages
// to known clients
RedisRelay.prototype.checkForMessages = function(connId) {
  debug.relay('RedisRelay:checkForMessages');
  if(connId && this.clientsByConnId[connId]) {

    if(this.clientsByConnId[connId].send &&
       this.clientsByConnId[connId]._internalState == this.OPEN) {

      this.clientsByConnId[connId]._internalState = this.SENDING;

      this.redisClient.multi()
        .lrange('sock.it:sendQueue::'+connId, 0, -1)
        .ltrim('sock.it:sendQueue::'+connId, 1, 0)
        .exec(function(err, res) {
          if(!err && res[0] && res[0].length) {
            // for(var i in res[0]) {
            //   res[0][i] = res[0][i];
            // }

// for(var i in res[0]) {
//   console.log('GOT MESSAGE FROM SEND QUEUE: '+JSON.parse(res[0][i]).messageId);
// }


            this.clientsByConnId[connId].send(JSON.stringify(res[0]));
            this.clientsByConnId[connId]._internalState = this.CLOSING;

          } else {
            this.clientsByConnId[connId]._internalState = this.OPEN;
          }
      }.bind(this));
    }

    if(this.clientsByConnId[connId].receive) {
      this.redisClient.multi()
        .lrange('sock.it:receiveQueue::'+connId, 0, -1)
        .ltrim('sock.it:receiveQueue::'+connId, 1, 0)
        .exec(function(err, res) {
          if(!err && res[0] && res[0].length) {
            for(var i in res[0]) {
// console.log('GOT MESSAGE FROM RECEIVE QUEUE: '+JSON.parse(res[0][i]).messageId);
              this.clientsByConnId[connId].receive(res[0][i]);
            }
          }
      }.bind(this));
    }

  }
};


