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

// You can change the colors, by setting .color to one of the following ints:
// Safe colors (works in most terminals)
// 1: Red, 2: Green, 3: Yellow, 4: Blue, 5: Magenta, 6: Cyan
//
// Other colors (should work in most terminals)
// 0: Black (gray but with timing in black - so invisble with black background)
// 7: Light gray
// 8+: (Currently) Sets the color to default terminal foreground color
global.debug = {};
global.debug.todo = require('debug')('sockit:todo');
global.debug.todo.color = 1;
global.debug.err = require('debug')('sockit:errors');
global.debug.err.color = 1;
global.debug.sys = require('debug')('sockit:system');
global.debug.sys.color = 999;
global.debug.srv = require('debug')('sockit:server');
global.debug.srv.color = 3;
global.debug.conn = require('debug')('sockit:connection');
global.debug.conn.color = 2;
global.debug.msgIn = require('debug')('sockit:messages in');
global.debug.msgIn.color = 4;
global.debug.msgOut = require('debug')('sockit:messages out');
global.debug.msgOut.color = 6;
global.debug.relay = require('debug')('sockit:relay');
global.debug.relay.color = 7;

var util = require("util");
var events = require("events");
var path = require('path');
var read = require('fs').readFileSync;

var browserLibrarySource = read(path.normalize(__dirname + '/../browser/client.js'), 'utf-8');
var browserLibraryVersion = require('../package').version;

var PollTransport = require('./transports/poll.js');
var WebSocketTransport = require('./transports/websocket.js');

var availableRelays = ['default', 'redis'];

var Server = function(httpServer, config) {
  if(!(this instanceof Server)) return new Server(httpServer, config);
  events.EventEmitter.call(this);
  this.setMaxListeners(0);

  if(typeof httpServer !== 'object' || !httpServer.listen) {
    throw new Error('Sock.it Server needs an http.Server instance');
  }

  config = config || {};

  this.httpServer = httpServer;
  this.httpServer.setMaxListeners(0);

  this.config = {
    path:            config.path            || '/sock.it/',
    // relay:           config.relay           || 'default',
    relay:           config.relay           || 'redis',
    cookieName:      config.cookieName      || 'sockIt-connId',
    cookieTimeout:   config.cookieTimeout   || 60 * 60 * 24, // 86400 = 1 day

    // How often should cleanup functions run?
    // Currently it's just clients (and messages?) in the relays
    // Should be 5+ minutes to ensure things aren't just slow, when removing the client
    cleanupInterval: config.cleanupInterval || 120
  }
  debug.todo('In server.js is it safe to remove "dead" clients after 2 mins?\
              What about slow connections and when the system is pressured?');

  this.config.clientPath = this.config.path + 'client.js';

  this.config.relay = this.initRelay(this.config.relay);

  this.attach();
};
util.inherits(Server, events.EventEmitter);

module.exports = Server;

/**
 * Attach and intercept requests on the server object
 */
Server.prototype.initRelay = function(name) {
  name = name || 'default';
  var relay = null;

  if(availableRelays.indexOf(name) !== -1) {
    Relay = require('./relays/'+name);
    relay = new Relay(this.config);
    // These should probably be timeout and the cleanup and checkAllForMessages,
    // should probably do a timeout themselves.... Maybe even storing the timer
    //setInterval(relay.cleanup, (this.config.cleanupInterval * 1000));
    setInterval(relay.checkAllForMessages.bind(relay), 200);
  }

  return relay;
};

/**
 * Attach and intercept requests on the server object
 */
Server.prototype.attach = function() {
  this.pollTransport = new PollTransport.Server(this.httpServer, this.config);
  this.pollTransport.on('connection', this.emit.bind(this, 'connection'));

  this.webSocketTransport = new WebSocketTransport.Server(this.httpServer, this.config);
  this.webSocketTransport.on('connection', this.emit.bind(this, 'connection'));

  debug.todo('Should we keep an array of clients in server.js, by listening to a "new client" event?');
  this.serveBrowserClientJS();
};

/**
 * Serve the client library
 * @param  {object} request  http request
 * @param  {object} response http response
 */
Server.prototype.serveBrowserClientJS = function(request, response) {
  this.requestListeners = this.httpServer.listeners('request').slice(0);
  this.httpServer.removeAllListeners('request');
  this.httpServer.on('request', this.handleRequest.bind(this));
};

Server.prototype.handleRequest = function(request, response) {
  request.host = request.headers.host;

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

