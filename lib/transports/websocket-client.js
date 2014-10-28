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
};


WebSocketClient.prototype.send =
WebSocketClient.prototype.sendMessage = function(msg) {
  // THere need to be some checks, to ensure the connection is actuall open

  var states = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'];

  this.readyState = this.CLOSED; // readonly

  if(this.ws.readyState != this.ws.OPEN) {
    console.log("THE WS AIN'T OPEN")
    console.log('the state is: '+states[this.ws.readyState]);
    console.log(this.ws.readyState);
  }

  this.ws.send(msg, function() {
    // Here to ensure, an error doesn't crash the process
  });

  // // @todo check for closed, connection, etc.
  // // set readyState to closing
  // console.log('send a message');
  // this.response.end(JSON.stringify({ msg: msg }));
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

      try {
        this.ws.send(msg);
      } catch(e) {
        console.log('send failed - putting message back into queue');
        this.messageQueue.unshift(msg);
      }

      this.messageTimer = null;
    }
  }

  if(this.messageQueue.length && !this.messageTimer) {
    console.log('starting up a timer');
    this.messageTimer = setTimeout(this.checkAndSendMessages.bind(this), 100);
  } else {
    this.messageTimer = null;
  }
};

