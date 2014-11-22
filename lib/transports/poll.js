/* Cookie stuff!!
  cookies:      new Cookies(request.headers.cookie),

  if(request.headers.cookie) {
    var cookies = new Cookies(request.headers.cookie);
    if(cookies[this.cookieName] && cookies[this.cookieName].value) {
      connId = cookies[this.cookieName].value;
    }
  }
  var now = new Date();
  var cookieExpires = now.setTime(now.getTime() + (this.cookieTimeout * 1000));

  var cookieStr = [
    this.cookieName, '=', this.client.connId, '; ',
    'expires=', now.toGMTString(), '; ',
    'path=', this.path, '; ',
    'secure; ', 'httpOnly', '; '
  ].join('');

  response.writeHead(200, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'Set-Cookie': cookieStr
  });
*/

var util = require('util');
var async = require('async');
var events = require('events');
var uuid = require('node-uuid');
var qs = require('querystring');
var Cookies = require('cookie-tools');
var PollConnection = require('./poll-connection');

// @todo CHECK WHAT EVENTS WS HAS AND "REPLICATE"

var PollTransport = function(httpServer, config) {
  events.EventEmitter.call(this);
  this.setMaxListeners(0);

  for(var i in config) this[i] = config[i];

  this.pathRegExp = new RegExp(this.path+'(poll.*|)$');

  this.config = config;

  this.connectionsByConnId = {};

  this.httpServer = httpServer;
  this.attach();
};
util.inherits(PollTransport, events.EventEmitter);

exports.Server = PollTransport;
exports.Client = PollConnection;

PollTransport.prototype.attach = function() {
  this.requestListeners = this.httpServer.listeners('request').slice(0);
  this.httpServer.removeAllListeners('request');
  this.httpServer.on('request', this.handleRequest.bind(this));
};

PollTransport.prototype.generateId = function() {
  return uuid.v1();
};

/**
 * Handle all requests on the server object
 * @param  {object} request  http request
 * @param  {object} response http response
 */
PollTransport.prototype.handleRequest = function(request, response) {
  // This has nothing to do with Sock.It - let somebody else worry about that!
  // request.host = request.headers.host;
  // That somebody else is me: It should probably be set in express-sock.js

  // If anything but the sock.it path, then call all the other listeners
  if(request.url.indexOf(this.path) === -1) {
    this.parseOnRequest(request, response);
  } else {
    async.waterfall([
      this.extractRequestInfo.bind(this, request, response),
      this.determineAction.bind(this, request, response),
    ], function(err) {
      if(err) this.sendBadRequest(request, response);
    }.bind(this));
  }
};

PollTransport.prototype.parseOnRequest = function(request, response) {
  for(var i=0 ; i < this.requestListeners.length ; i++) {
    this.requestListeners[i].call(this.httpServer, request, response);
  }
};

PollTransport.prototype.extractRequestInfo = function(request, response, next) {
  var cookies = new Cookies(request.headers.cookie);
  var connId = cookies[this.config.cookieName] ? cookies[this.config.cookieName].value : null;

  if(connId) {
    this.config.relay.getClient(connId, next)

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

  if(!clientInfo || requestPath === 'poll-start') {
    this.handlePollStartRequest(request, response, clientInfo, next);

  } else if(requestPath === 'poll-msg') {
    this.handlePollMessageRequest(request, response, clientInfo, next);

  } else if(requestPath + 'poll') {
    this.handlePollRequest(request, response, clientInfo, next);

  } else {
    next(new Error('Unknown request'));
  }
};


PollTransport.prototype.handlePollStartRequest = function(request, response, clientInfo, next) {
  debug.conn('GOT A POLL START');
  // If we have no info on the client, we treat this is a start request
  // If we do have info on the client, we still start over, to ensure security
  // A poll-start should be thought of as a websockets initial request
  // While a poll is the same as a websocket re-establishing contact

  if(clientInfo && clientInfo.connId) {
    this.config.relay.removeClient(clientInfo);
  }

  clientInfo = { connId: this.generateId() };

  this.config.relay.addClient(clientInfo, function(err) {
    if(err) return next(err);

    this.sendPollStartResponse(request, response, clientInfo.connId);
    next();
  }.bind(this));

};

PollTransport.prototype.handlePollMessageRequest = function(request, response, clientInfo, next) {
  debug.conn('GOT A POLL MESSAGE');
  var body = '';

  // A little funny story here:
  // close events ONLY happens on broken connections - error event I haven't seen yet...
  response.on('close', function() {
    debug.todo('What should be done here? If anything at all...');
  }.bind(this));

  request.on('data', function(data) { body += data; });

  request.on('end', function () {
    // Should the body be doubled encoded, so that we only assume there
    // is messages encoded in a JSON array?
    debug.todo('Messages needs to be an array in the future!');
    this.config.relay.receiveMessages(clientInfo.connId, body);

    response.end();

    next();

  }.bind(this));
};

PollTransport.prototype.handlePollRequest = function(request, response, clientInfo, next) {
  // So: a poll connection IS a connection - messages are NOT.
  // It's possible, there will come messages directly on the PollClient
  // Should there be some way of hiding a reconnect?
  // It is unlikely a redis poll should reconnect to the exact same
  // process, but for 1 process sock.it - it is rather likely!
  // On single process connections, it is not a big problem to expire,
  // but on multi, a receiving poll should check that it is the active 1
  debug.conn('STARTING UP A POLL CONNECTION');

  if(this.connectionsByConnId[clientInfo.connId]) {
    debug.conn('FOUND AN EXISTING CONNECTION');
    var pollConnection = this.connectionsByConnId[clientInfo.connId];

  } else {
    debug.conn('STARTING NEW CONNECTION');
    var pollConnection = new PollConnection({
      url: this.path,
      connId: clientInfo.connId,
    });

    this.connectionsByConnId[clientInfo.connId] = pollConnection;
  }

  pollConnection.request = request;
  pollConnection.response = response;
  pollConnection.upgradeReq = { headers: request.headers };

  pollConnection.response.on('close', function() {
    pollConnection.readyState = this.CLOSING;
  }.bind(this));

  if(!pollConnection._initialConnectionDone) {
    this.config.relay.attachToConnection(pollConnection, function(err) {
      pollConnection._initialConnectionDone = true;
      this.emit('connection', pollConnection);
    }.bind(this));

  } else {
    this.config.relay.attachToConnection(pollConnection, function(err) {
      pollConnection._initialConnectionDone = true;
    }.bind(this));
  }

  next();
};


PollTransport.prototype.sendPollStartResponse = function(request, response, connId) {
  var now = new Date();
  var cookieExpires = now.setTime(now.getTime() + (this.cookieTimeout * 1000));

  debug.todo('Make cookie secure ONLY if https is used');
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
  debug.conn('SENDING END');
  response.end('poll-start');
}

PollTransport.prototype.sendBadRequest = function(request, response) {
  response.writeHead(400, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  });
  response.end('Bad Request');
};

