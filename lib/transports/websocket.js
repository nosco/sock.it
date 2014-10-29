var util = require("util");
var uuid = require('node-uuid');
var events = require("events");
var WSServer = require('ws').Server;

var WebSocketClient = require('./websocket-client');

var WebSocketTransport = function(httpServer, config) {
  events.EventEmitter.call(this);
  this.setMaxListeners(0);

  this.httpServer = httpServer;

  for(var i in config) this[i] = config[i];

  this.clients = [];
  this.clientsByConnId = {};


  this.attach();
};
util.inherits(WebSocketTransport, events.EventEmitter);
exports.Server = WebSocketTransport;

WebSocketTransport.prototype.attach = function() {
  this.wsServer = new WSServer({ server: this.httpServer });

  this.clients = this.wsServer.clients;

  this.wsServer.on('connection', function(ws) {
    var connId = this._generateId();

// console.log('');
// console.log('INIT WS');
// console.log('');

    // console.log(connId);
    // console.log(ws.upgradeReq.headers['user-agent']);
    // console.log(ws.upgradeReq.headers['sec-websocket-key']);

    var client = new WebSocketClient({
      ws: ws,
      connId: connId
    });

    this.clientsByConnId[connId] = client;

    client.on('close', function() {
      // console.log('removing the closed websocket');
      delete this.clientsByConnId[connId];
// console.log(require('util').inspect(this.clientsByConnId, {depth:0}));
    }.bind(this));

    client.on('error', function() {
      // console.log('removing the erred websocket');
      delete this.clientsByConnId[connId];
// console.log(require('util').inspect(this.clientsByConnId, {depth:0}));
    }.bind(this));

    // this.clients.push(client);

// console.log(this.clients.length);
// console.log(require('util').inspect(this.clientsByConnId, {depth:0}));

// for(var i in this.clientsByConnId) {
//   var client = this.clientsByConnId[i].ws.send('{test: test}');
// }


    this.emit('connection', client);
  }.bind(this));
};

WebSocketTransport.prototype._generateId = function() {
  return uuid.v1();
};
