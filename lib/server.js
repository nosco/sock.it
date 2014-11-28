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
global.debug.msgIn = require('debug')('sockit:message-in');
global.debug.msgIn.color = 4;
global.debug.msgOut = require('debug')('sockit:message-out');
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
    // cleanupInterval: config.cleanupInterval || 120
    cleanupInterval: 300
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

    // Not needed, right? It seems that as long as stuff works, this fine!
    // setInterval(relay.checkAllForMessages.bind(relay), 200);
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

