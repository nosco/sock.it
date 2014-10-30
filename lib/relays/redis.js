var redis = require('redis');
var uuid = require('node-uuid');
var async = require('async');
var util = require("util");
var events = require("events");
// var _JSON = require('../json.prune.js');

var RedisRelay = function(config) {
  if(RedisRelay.prototype._singleton) {
    return RedisRelay.prototype._singleton;
  }
  RedisRelay.prototype._singleton = this;

  events.EventEmitter.call(this);
  this.setMaxListeners(0);

  config = config || {};

  for(var i in config) this[i] = config[i];

  this.pubSubClient = this.pubSubClient || redis.createClient();
  this.senderClient = this.senderClient || redis.createClient();
  this.lookupClient = this.lookupClient || redis.createClient();

  this.clientsByConnId = {};

  this.listenForMessages();
};
util.inherits(RedisRelay, events.EventEmitter);
module.exports = RedisRelay;

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

    this.lookupClient.lrange('sock.it:messages::'+connId, 0, 1000, function(err, res) {
      if(err) {
        // console.log('THERE WAS AN ERROR!')
        // console.log(err);
      } else if(!err && res.length) {
        // console.log('FOUND SOME');
        console.log('GOING TO LTRIM '+res.length);
        this.lookupClient.ltrim('sock.it:messages::'+connId, res.length, 1000, function() {
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
        //       this.lookupClient.lpush('sock.it:messages::'+connId, msg, function() {});
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
  this.lookupClient.rpush('sock.it:messages::'+clientInfo.connId, message, function() {
    this.senderClient.publish('sock.it:messages', clientInfo.connId, function() {});
  }.bind(this));
};

RedisRelay.prototype.getClientInfo = function(connId, cb) {
  this.lookupClient.get('sock.it:client::'+connId, function(err, res) {
    if(res) res = JSON.parse(res);
    cb(err, res);
  });
};

RedisRelay.prototype.createClient = function(clientInfo, cb) {
  clientInfo.connId = clientInfo.connId || this._generateId();
  clientInfo.lastActivity = new Date();
  // var pollClient = this.clientsByConnId[clientInfo.connId];
  this.lookupClient.set('sock.it:client::'+clientInfo.connId, JSON.stringify(clientInfo), function(err, res) {
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

RedisRelay.prototype._generateId = function() {
  return uuid.v1();
};
