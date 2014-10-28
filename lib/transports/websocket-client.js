var util = require("util");
var events = require("events");
var Cookies = require('cookie-tools');

var WebSocketClient = function(info) {
  events.EventEmitter.call(this);
  this.setMaxListeners(0);

  for(var i in info) this[i] = info[i];
  this.headers = this.ws.upgradeReq.headers;
  this.host = this.headers.host;
  this.cookies = new Cookies(this.headers.cookie);

  this.messageQueue = [];
  this.messageTimer = null;

  this.initConnection();
};
util.inherits(WebSocketClient, events.EventEmitter);
module.exports = WebSocketClient;

WebSocketClient.prototype.initConnection = function() {
  this.ws.on('close', this.emit.bind(this, 'close'));
  this.ws.on('message', this.emit.bind(this, 'message'));

  this.ws.on('error', function() {
    console.log('WEBSOCKET ERROR');
    console.log(arguments);
  });

};


WebSocketClient.prototype.send =
WebSocketClient.prototype.sendMessage = function(msg) {
  this.messageQueue.push(msg);
  this.checkAndSendMessages();
};

WebSocketClient.prototype.checkAndSendMessages = function() {
  // @todo check for closed, connection, etc.

  if(this.messageQueue.length) {
    if(this.ws.readyState === this.ws.OPEN) {

    var msg = this.messageQueue.shift();
      try { this.ws.send(msg); }
      catch(e) { this.messageQueue.unshift(msg); }
      this.messageTimer = null;
    }
  }

  if(this.messageQueue.length && !this.messageTimer) {
    this.messageTimer = setTimeout(this.checkAndSendMessages.bind(this), 200);
  } else {
    this.messageTimer = null;
  }
};

