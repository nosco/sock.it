var util = require("util");
var events = require("events");
var qs = require('querystring');
var uuid = require('node-uuid');
var Cookies = require('cookie-tools');
var PollClient = require('./poll-client');

// @todo CHECK WHAT EVENTS WS HAS AND "REPLICATE"

var PollTransport = function(httpServer, config) {
  events.EventEmitter.call(this);
  this.setMaxListeners(0);

  this.clientsByConnId = {};

  this.httpServer = httpServer;
  this.config = config;
  this.attach();
};
util.inherits(PollTransport, events.EventEmitter);

exports.Server = PollTransport;
exports.Client = PollClient;

PollTransport.prototype.attach = function() {
  this.requestListeners = this.httpServer.listeners('request').slice(0);
  this.httpServer.removeAllListeners('request');
  this.httpServer.on('request', this.onRequest.bind(this));
};

/**
 * Handle all requests on the server object
 * @param  {object} request  http request
 * @param  {object} response http response
 */
PollTransport.prototype.onRequest = function(request, response) {
  var cookieConnId = null;
  if(request.headers.cookie) {
    var cookies = new Cookies(request.headers.cookie);
    cookieConnId = cookies[this.config.cookieName] ? cookies[this.config.cookieName].value : null;
  }

  if(request.url === this.config.path + 'poll-msg') {
    if(this.clientsByConnId[cookieConnId]) {
      this.clientsByConnId[cookieConnId].receiveMessage(request, response);
    } else {
      // Send a "please reconnect" response
    }

  } else if(request.url === this.config.path + 'poll') {
    if(this.clientsByConnId[cookieConnId]) {
      this.clientsByConnId[cookieConnId].openConnection(request, response);
    } else {
      this.createClient(request, response);
    }

  } else if(request.url === this.config.path + 'poll-start') {
    this.createClient(request, response);

  } else {
    for(var i=0 ; i < this.requestListeners.length ; i++) {
      this.requestListeners[i].call(this.httpServer, request, response);
    }
  }
};

PollTransport.prototype.createClient = function(request, response) {
  var connId = null;
  this.clientsCleanup();

  if(request.headers.cookie) {
    var cookies = new Cookies(request.headers.cookie);
    if(cookies[this.config.cookieName] && cookies[this.config.cookieName].value) {
      connId = cookies[this.config.cookieName].value;
    }
  }

  if(!connId) {
    connId = this._generateId();
  }

  this.host = request.headers.host;

  var client = new PollClient({
    host: this.host,
    connId: connId,
    config: this.config,
    cookies: new Cookies(request.headers.cookie),
    request: request,
    response: response,
    lastActivity: new Date()
  });

  this.clientsByConnId[connId] = client;

// client.on('close', function() {
//   console.log('test to see if a removal will work correctly');
//   console.log(arguments);
// });

  client.on('connection', function(client) {
// console.log('POLL CONNECTION');
    this.emit('connection', client);
    console.log(require('util').inspect(this.clientsByConnId, {depth:0}));
  }.bind(this));

  client.on('close', function(client) {
// console.log('CLOSE POLL TRYING TO REMOVE');
    this.emit('close', client);
    delete this.clientsByConnId[client.connId];
// console.log(require('util').inspect(this.clientsByConnId, {depth:0}));
  }.bind(this));

  client.on('error', function(client) {
// console.log('ERROR ON POLL TRYING TO REMOVE');
    this.emit('error', client);
    delete this.clientsByConnId[client.connId];
// console.log(require('util').inspect(this.clientsByConnId, {depth:0}));
  }.bind(this));

  client.on('close', function() {
// console.log('CLOSE POLL TRYING TO REMOVE');
    // this.emit('close', this.clientsByConnId[connId]);
    delete this.clientsByConnId[connId];
// console.log(require('util').inspect(this.clientsByConnId, {depth:0}));
  }.bind(this));

  client.on('error', function() {
// console.log('ERROR POLL TRYING TO REMOVE');
    this.emit('error', this.clientsByConnId[connId]);
    delete this.clientsByConnId[connId];
// console.log(require('util').inspect(this.clientsByConnId, {depth:0}));
  }.bind(this));

// console.log(require('util').inspect(this.clientsByConnId, {depth:0}));


  client.initConnection(request, response);
};


PollTransport.prototype.clientsCleanup = function() {
  // console.log('clientsCleanup');
  var now = new Date();
  // var minAge = now.setTime(now.getTime() + (3600 * 1000)); // 1 hour
  var minAge = now.setTime(now.getTime() - (60 * 1000)); // 60 sec
  for(var connId in this.clientsByConnId) {
    if(this.clientsByConnId[connId].lastActivity < minAge) {
      // console.log('CLIENT IS GOING TO EMIT CLOSE');
      delete this.clientsByConnId[connId];
      this.clientsByConnId[connId].emit('close', this.clientsByConnId[connId]);
    }
  }
};


PollTransport.prototype._generateId = function() {
  return uuid.v1();
};
