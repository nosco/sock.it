/* The flow of a poll connection:
 * Client: open a connection please (with cookie)
 * Server: open and hold the connection
 *
 *      OR
 *
 * Client: open a connection please (with cookie)
 * Server: connection open (maybe: your id: bcafdefcb3f3eb3fc)
 * [CONNECTION CLOSES]
 * Client: open poll connection (maybe: with id: bcafdefcb3f3eb3fc)
 * Server: open and hold the connection
 *
 * Client: Please send me an idea list
 * Server: Here it is: {}
 * Server: [CLOSES CONNECTION]
 * Client: open poll connection (maybe: with id: bcafdefcb3f3eb3fc)
 * Server: open and hold the connection
 *
 * Thinks this through:
 * After ~30 secs the connection should be closed and re-established
 * The best would be, if this could look like a websocket ping/pong
 *   at least at the API level
 *
 * Other thoughts:
 * - Keep a list of clients and listen for redis pub/sub events
 * - Should server subscribe to events pr. user or receive all and filter?
 * - The former causes a lot of pub/subs, while the latter causes a lot of noise
 * - Should a client be able to send a request in the "open" request?
 *     UPDATE: At least it should ONLY be for queued messages then...
 *     It is not in the WebSocket API, so it shouldn't be in Sock.it
 * - Should the client be able to send more than 1 request pr. connection?
 * - Should the server be able to send more than 1 reply pr. connection?
 * - Is pub/sub good enough for message parsing? It should be, as long as
 *     the client is resilient enough to re-request "lost" messages, though it
 *     is not optimal - is it possible to queue up correctly in redis?
 *     UPDATE: it seems like being resilient is the speediest and less
 *     complicated way to go.
 * - Upon lost connection between client and server, the client should resend
 *     any unanswered messages, that should make the system resilient enough
 *     to handle lost messages
 *     UPDATE: This should NOT be handled in the base code, as it is not part
 *     of the WebSocket API.
 * - Concerning the above: code first for non-redis integration!
 * - ANY cookies should be set on the full domain AND the path (i.e. /sock.it/)!
 *
 * The pub/sub layer:
 * - A request should just be put into the redis pub/sub
 *
/* TODO:
 * - How to "store" clients
 * - How to utilize redis - probably subscribe to "domain room" and "domain user"
 * - Don't start a redis client pr user - do it pr process
 *
 * Is this necessary:
 * // prevent XSS warnings on IE
 * // https://github.com/LearnBoost/socket.io/pull/1333
 * var ua = this.req.headers['user-agent'];
 * if (ua && (~ua.indexOf(';MSIE') || ~ua.indexOf('Trident/'))) {
 *   headers['X-XSS-Protection'] = '0';
 * }
 */

var util = require("util");
var events = require("events");
var uuid = require('node-uuid');
var path = require('path');
var read = require('fs').readFileSync;
var browserLibrarySource = read(path.normalize(__dirname + '/../browser/client.js'), 'utf-8');
var browserLibraryVersion = require('../package').version;

var PollTransport = require('./transports/poll.js');
var WebSocketTransport = require('./transports/websocket.js');

// @todo Make it configurable
var Server = function(httpServer, config) {
  if(!(this instanceof Server)) return new Server(httpServer);
  events.EventEmitter.call(this);
  this.setMaxListeners(0);


  if(typeof httpServer !== 'object' || !httpServer.listen) {
    throw new Error('Sock.it Server needs an http.Server instance');
  }

  this.httpServer = httpServer;
  this.httpServer.setMaxListeners(0);

  config = config || {};

  this.config = {
    cookieName:    config.cookieName    || 'sockIt-connId',
    cookieTimeout: config.cookieTimeout || 60 * 60 * 24, // 86400 = 1 day
    path:          config.path          || '/sock.it/',
  }

  this.config.clientPath = this.config.path + 'client.js';

  this.clients = [];
  this.clientsReversed = {};

  this.attach();
};
util.inherits(Server, events.EventEmitter);

module.exports = Server;

/**
 * Attach and intercept requests on the server object
 */
Server.prototype.attach = function() {
  this.pollTransport = new PollTransport.Server(this.httpServer, this.config);
  this.pollTransport.on('connection', this.addClient.bind(this));
  this.pollTransport.on('close', this.removeClient.bind(this));
  this.pollTransport.on('error', this.removeClient.bind(this));

  this.webSocketTransport = new WebSocketTransport.Server(this.httpServer, this.config);
  this.webSocketTransport.on('connection', this.addClient.bind(this));
  this.webSocketTransport.on('close', this.removeClient.bind(this));
  this.webSocketTransport.on('error', this.removeClient.bind(this));

  // Should we keep an array of clients, by listening to a "new client" event?
  this.serveBrowserClientJS();
};

Server.prototype.addClient = function(client) {
// console.log('add client:');
// console.log(require('util').inspect(client, {depth:0}));
  client.clientId = this.clients.push(client);
  this.clientsReversed[client.connId] = client;
  this.emit('connection', client);
};


Server.prototype.removeClient = function(client) {
// console.log('remove client:');
// console.log(require('util').inspect(client, {depth:0}));
  delete this.clients[client.connId];
  delete this.clientsReversed[client.connId];
  this.emit('connection', client);
};

/**
 * Serve the client library
 * @param  {object} request  http request
 * @param  {object} response http response
 */
Server.prototype.serveBrowserClientJS = function(request, response) {
  this.requestListeners = this.httpServer.listeners('request').slice(0);
  this.httpServer.removeAllListeners('request');
  this.httpServer.on('request', this.onRequest.bind(this));
};

Server.prototype.onRequest = function(request, response) {
  // Check if this is a request for sock.it
  if(request.url !== this.config.clientPath) {
    for(var i=0 ; i < this.requestListeners.length ; i++) {
      this.requestListeners[i].call(this.httpServer, request, response);
    }
    return;

  } else {
    // var ifNoneMatch = request.headers['if-none-match'];
    // if(ifNoneMatch && ifNoneMatch === browserLibraryVersion) {
    //   response.writeHead(304);
    //   response.end();
    //   return;
    // }

    response.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    // Yay node, express and whatever...
    // This is the ONLY way I got ETag to work.......
    response.setHeader('ETag', browserLibraryVersion);
    response.writeHead(200, { etag: browserLibraryVersion });
    response.end(browserLibrarySource);
  }
};

