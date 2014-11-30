var util = require('util');
var async = require('async');
var events = require('events');
var uuid = require('node-uuid');
var qs = require('querystring');
var Cookies = require('cookie-tools');
var PollConnection = require('./poll-connection');
var PollClient = require('./poll-client');

// @todo CHECK WHAT EVENTS WS HAS AND "REPLICATE"

var PollTransport = function(httpServer, config) {
  events.EventEmitter.call(this);
  this.setMaxListeners(0);

  for(var i in config) this[i] = config[i];

  this.pathRegExp = new RegExp(this.path+'(poll.*|)$');

  this.httpServer = httpServer;
  this.attach();
};
util.inherits(PollTransport, events.EventEmitter);

module.exports = PollTransport;

PollTransport.prototype.attach = function() {
  this.requestListeners = this.httpServer.listeners('request').slice(0);
  this.httpServer.removeAllListeners('request');
  this.httpServer.on('request', this.handleRequest.bind(this));
};

PollTransport.prototype.generateId = function() {
  return uuid.v1();
};

PollTransport.prototype.handleRequest = function(request, response) {
  // If anything but the sock.it path, then call all the other listeners
  if(request.url.indexOf(this.path) === -1) {
    for(var i=0 ; i < this.requestListeners.length ; i++) {
      this.requestListeners[i].call(this.httpServer, request, response);
    }

  } else {
    async.waterfall([
      this.extractRequestInfo.bind(this, request, response),
      this.determineAction.bind(this, request, response),
    ], function(err) {
      if(err) this.sendBadRequest(request, response);
    }.bind(this));
  }
};


PollTransport.prototype.extractRequestInfo = function(request, response, next) {
  request.cookies = new Cookies(request.headers.cookie);
  var connId = request.cookies[this.cookieName] ? request.cookies[this.cookieName].value : null;
  if(connId) {
    this.relay.getClient(connId, next)
  } else {
    next(null, null);
  }
};


PollTransport.prototype.determineAction = function(request, response, clientInfo, next) {
  var pollClient = null;
  var requestPath = 'poll-start';


  var urlMatch = this.pathRegExp.exec(request.url);
  if(urlMatch && urlMatch[1]) {
    // @todo Should we rather throw an error, than assuming poll-start in poll.js?
    var requestPath = urlMatch[1];
  }

  // @todo should we consider letting clients re-use connId during poll-start?
  // We need to be 100% sure, connections will die fast, so we don't get re-uses
  // of old connections and to ensure some level of security, though that should
  // be left mainly to other mechanisms, we "only" need to make the poll as safe
  // as a WebSocket.
  if(!clientInfo || requestPath === 'poll-start') {
    // @todo should we ensure, that a new client isn't being started, if this is
    // a "re-connecting" poll-start? Is it possible at all?
    this.handlePollStartRequest(request, response, clientInfo, next);

  } else if(requestPath === 'poll-msg') {
    this.relay.handleMessageRequest(request, response, clientInfo);
    next();

    // this.handlePollMessageRequest(request, response, clientInfo, next);

  } else if(requestPath === 'poll') {
    this.handlePollRequest(request, response, clientInfo, next);

  } else {
    next(new Error('Unknown request'));
  }
};


PollTransport.prototype.handlePollStartRequest = function(request, response, clientInfo, next) {
  debug.conn('GOT A POLL START REQUEST');
  // If we have no info on the client, we treat this is a start request
  // If we do have info on the client, we still start over, to ensure security
  // A poll-start should be thought of as a websockets initial request
  // While a poll is the same as a websocket re-establishing contact

  // if(clientInfo && clientInfo.connId) {
  //   // This should somehow trigger a disconnect/close on other processes
  //   this.relay.removeClient(clientInfo);
  // }

  if(!clientInfo || !clientInfo.connId) {
console.log('NEW clientInfo generated');
    clientInfo = { connId: this.generateId() };
  }

  this.relay.addClient(clientInfo, function(err) {
    if(err) return next(err);

    var pollClient = new PollClient(request, response, clientInfo, this.relay);

    this.sendPollStartResponse(request, response, clientInfo.connId);

    this.emit('connection', pollClient);

    next();
  }.bind(this));

};

PollTransport.prototype.handlePollRequest = function(request, response, clientInfo, next) {
  debug.conn('GOT A POLL REQUEST');
  // If we have no info on the client, we treat this is a start request
  // If we do have info on the client, we still start over, to ensure security
  // A poll-start should be thought of as a websockets initial request
  // While a poll is the same as a websocket re-establishing contact

  if(!clientInfo) return next(new Error('Unknown client'));

  new PollConnection(request, response, clientInfo, this.relay);

  next();

};


PollTransport.prototype.sendPollStartResponse = function(request, response, connId) {
  var now = new Date();
  var cookieExpires = now.setTime(now.getTime() + (this.cookieTimeout * 1000));

  debug.todo('Make cookie secure ONLY if https is used (if possible at all)');
  debug.todo('It would also be possible to do through HAProxy or something');
  var cookieStr = [
    this.cookieName, '=', connId, '; ',
    'expires=', now.toGMTString(), '; ',
    'path=', this.path, '; ',
    'httpOnly', '; '
  ].join('');

  response.writeHead(200, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'Set-Cookie': cookieStr
  });
  debug.conn('FINISHING POLL START REPLY');
  response.end('poll-start');
}

PollTransport.prototype.sendBadRequest = function(request, response) {
  response.writeHead(400, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  });
  response.end('Bad Request');
};
