var util = require("util");
var uuid = require('node-uuid');
var events = require("events");
var WSServer = require('ws').Server;

var WebSocketClient = require('./websocket-client');

var WebSocketTransport = function(httpServer, config) {
  events.EventEmitter.call(this);
  this.setMaxListeners(0);

  this.httpServer = httpServer;

  for(var key in config) this[key] = config[key];

  this.clients = [];
  this.clientsByConnId = {};


  this.attach();
};
util.inherits(WebSocketTransport, events.EventEmitter);
exports.Server = WebSocketTransport;

WebSocketTransport.prototype.attach = function() {
  this.wsServer = new WSServer({ server: this.httpServer });

  this.clients = this.wsServer.clients;

  // this.wsServer.on('connection', function(ws) {
  this.wsServer.on('connection', function(client) {
    debug.conn('STARTING UP A WEBSOCKET CLIENT');
    var connId = this.generateId();
    client.connId = connId;

    // var client = new WebSocketClient({
    //   ws: ws,
    //   connId: connId
    // });

    this.clientsByConnId[connId] = client;

    client.on('close', function() {
      debug.conn('WebSocket connection closed');
      delete this.clientsByConnId[connId];
    }.bind(this));

    client.on('error', function() {
      debug.err('WebSocket connection error');
      debug.err(arguments);

      delete this.clientsByConnId[connId];
    }.bind(this));

    this.emit('connection', client);
  }.bind(this));
};

WebSocketTransport.prototype.generateId = function() {
  return uuid.v1();
};
