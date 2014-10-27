var util = require("util");
var uuid = require('node-uuid');
var events = require("events");
var WSServer = require('ws').Server;

var WebSocketClient = require('./websocket-client');

var WebSocketTransport = function(httpServer, config) {
  this.clients = [];
  this.clientsByConnId = {};

  this.httpServer = httpServer;
  this.config = config;
  this.attach();
};
util.inherits(WebSocketTransport, events.EventEmitter);
exports.Server = WebSocketTransport;

WebSocketTransport.prototype.attach = function() {

  this.wsServer = new WSServer({ server: this.httpServer });

  this.clients = this.wsServer.clients;

  this.wsServer.on('connection', function(ws) {
    var connId = this._generateId();
    var client = new WebSocketClient({
      ws: ws,
      connId: connId
    });

    this.clients.push(client);
    this.clientsByConnId[connId] = client;

    this.emit('connection', client);
  }.bind(this));
};

WebSocketTransport.prototype._generateId = function() {
  return uuid.v1();
};
