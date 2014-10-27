var util = require("util");
var events = require("events");
var Cookies = require('cookie-tools');

var WebSocketClient = function(info) {
  for(var i in info) this[i] = info[i];
  this.headers = this.ws.upgradeReq.headers;
  this.host = this.headers.host;
  this.cookies = new Cookies(this.headers.cookie);

  this.initConnection();
};
util.inherits(WebSocketClient, events.EventEmitter);
module.exports = WebSocketClient;

WebSocketClient.prototype.initConnection = function() {
  this.ws.on('close', this.emit.bind(this, 'close'));
  this.ws.on('message', this.emit.bind(this, 'message'));
};


WebSocketClient.prototype.send =
WebSocketClient.prototype.sendMessage = function(msg) {
  this.ws.send(msg);

  // // @todo check for closed, connection, etc.
  // // set readyState to closing
  // console.log('send a message');
  // this.response.end(JSON.stringify({ msg: msg }));
};
