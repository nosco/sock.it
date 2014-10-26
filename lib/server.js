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
 * Is this necessary:
 * // prevent XSS warnings on IE
 * // https://github.com/LearnBoost/socket.io/pull/1333
 * var ua = this.req.headers['user-agent'];
 * if (ua && (~ua.indexOf(';MSIE') || ~ua.indexOf('Trident/'))) {
 *   headers['X-XSS-Protection'] = '0';
 * }
 */

var uuid = require('node-uuid');
var PollTransport = require('./transports/poll.js');
var WebSocketTransport = require('./transports/websocket.js');

// @todo Make it configurable
var Server = function(httpServer, config) {
  if(!(this instanceof Server)) return new Server(httpServer);

  if(typeof httpServer !== 'object' || !httpServer.listen) {
    throw new Error('Sock.it Server needs an http.Server instance');
  }

  this.httpServer = httpServer;

  config = config || {};

  this.config = {
    cookieName:    config.cookieName    || 'sockIt-connId',
    cookieTimeout: config.cookieTimeout || 60 * 60 * 24, // 86400 = 1 day
    path:          config.path          || '/sock.it/',
  }

  // this.clients = [];
  // this.clientsReversed = {};

  this.attach();

  // this.config.httpServer.on('request', this._onRequest.bind(this));

  // this.config.httpServer.on('connection', function() {
  //   console.log('CONNECTION');
  //   make it possible to authenticate at this point?
  // });

  // console.log(server);
};
module.exports = Server;


/**
 * Attach and intercept requests on the server object
 */
Server.prototype.attach = function() {
  this.pollServer = new PollTransport.Server(this.httpServer, this.config);
  this.webSocketServer = new WebSocketTransport.Server(this.httpServer, this.config);
};

