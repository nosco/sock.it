var util = require("util");
var events = require("events");
var qs = require('querystring');
var uuid = require('node-uuid');
var Cookies = require('cookie-tools');
var PollClient = require('./poll-client');

// @todo CHECK WHAT EVENTS WS HAS AND "REPLICATE"

var PollTransport = function(httpServer, config) {
  this.clients = [];
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
    }

  } else if(request.url === this.config.path + 'poll') {
    if(this.clientsByConnId[cookieConnId]) {
      this.clientsByConnId[cookieConnId].openConnection(request, response);
    }

  } else if(request.url === this.config.path + 'poll-start') {
    this.initConnection(request, response);

  } else {
    for(var i=0 ; i < this.requestListeners.length ; i++) {
      this.requestListeners[i].call(this.httpServer, request, response);
    }
  }
};

PollTransport.prototype.initConnection = function(request, response) {
  var connId = this._generateId();

  this.host = request.headers.host;

  // @todo figure out, whether we want to use cookies or not...
  // What about just putting it in the url?

  // Maybe use cookieTools here?

  var now = new Date();
  var cookieExpires = now.setTime(now.getTime() + (this.config.cookieTimeout * 1000));
  var cookieStr = [
    this.config.cookieName, '=', connId, '; ',
    'expires=', now.toGMTString(), '; ',
    'path=', this.config.path, '; ',
    'secure', 'httpOnly', '; '
  ].join('');

  response.writeHead(200, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'Set-Cookie': cookieStr
  }); // No JSON for IE8?..

  var msg = connId;

  // @todo make sure, there isn't a race condition between end and the attach on the client

  var client = new PollClient({
    httpServer: this.httpServer,
    connId: connId,
    config: this.config,
    host: this.host,
    cookies: new Cookies(request.headers.cookie)
  });

  this.clients.push(client);
  this.clientsByConnId[connId] = client;

  this.emit('connection', client);

  response.end(msg);
};

PollTransport.prototype._generateId = function() {
  return uuid.v1();
};
