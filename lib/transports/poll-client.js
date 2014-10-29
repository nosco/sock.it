var util = require("util");
var events = require("events");

var PollClient = function(client, config) {
  events.EventEmitter.call(this);
  this.setMaxListeners(0);

  config = config || {};
  for(var i in config) this[i] = config[i];

  this.messageQueue = [];

  this.messageTimer = null;

  this.OPENING   = 0;
  this.WAITING   = 1;
  this.SENDING   = 2;
  this.CLOSING   = 3;
  this.sendState = this.OPENING;

  this.client = client;
};
util.inherits(PollClient, events.EventEmitter);
module.exports = PollClient;

// Check om ikke alt dette er vildt unødvendigt!...
PollClient.prototype.initConnection = function(request, response) {
  this.request = request;
  this.response = response;

  var now = new Date();
  var cookieExpires = now.setTime(now.getTime() + (this.cookieTimeout * 1000));

  var cookieStr = [
    this.cookieName, '=', this.client.connId, '; ',
    'expires=', now.toGMTString(), '; ',
    'path=', this.path, '; ',
    'secure; ', 'httpOnly', '; '
  ].join('');

  response.writeHead(200, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'Set-Cookie': cookieStr
  });

  var msg = 'poll-start';

  // @todo make sure, there isn't a race condition between end and the attach on the client
  response.end(msg);
};


PollClient.prototype.openConnection = function(request, response) {
  this.sendState = this.OPENING;
  this.client.lastActivity = new Date();
// console.log('POLL: openConnection');

  // It would be possible to send a request from client to server in this
  // request - just look for something in the body...
  response.writeHead(200, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  }); // No JSON for IE8?..

  this.request = request;
  this.response = response;

  this.headers = request.headers;
  this.host = this.headers.host;

  this.sendState = this.WAITING;

  this.emit('connection', this);

  // this.checkAndSendMessages();
};

PollClient.prototype.send =
PollClient.prototype.sendMessage = function(msg) {
  // console.log('SEND GOT:');
  // console.log(msg);
  // this.messageQueue.push(msg);
  // this.checkAndSendMessages();
};

PollClient.prototype.receiveMessage = function(request, response) {
  this.lastActivity = new Date();

  this.request = request;
  this.response = response;

  this.headers = request.headers;
  this.host = this.headers.host;

  if(request.method == 'POST') {
    var body = '';
    request.on('data', function(data) {
      body += data;
    }.bind(this));

    request.on('end', function () {
console.log('RECEIVED (on worker: '+process.env.WORKER+'):');
console.log(body);
      this.emit('message', body);
      response.end();
    }.bind(this));
  }
};


PollClient.prototype.checkAndSendMessages = function(cb) {
  this.client.lastActivity = new Date();

  cb = cb || function() {};

  // console.log('this.sendState');
  // console.log(this.sendState);
  // console.log('this.messageQueue.length');
  // console.log(this.messageQueue.length);

  // @todo check for closed, connection, etc.
  if(this.sendState === this.WAITING && this.messageQueue.length) {
    if( this.response && !this.response.finished && this.response.end) {
      // @todo there should probably be some error checks like the websocket does it
      // var count = this.messageQueue.length;
      // var messagesToSend = this.messageQueue.splice(0, count);

      this.response.on('error', function() {
        console.log('CAUGHT A RESPONSE ERROR!..');
        cb(false);
      });

      this.response.on('end', function() {
        console.log('EVERYTHING SEEMS NORMAL');
        cb(true);
      });
      this.sendState = this.SENDING;
      this.response.end(JSON.stringify(this.messageQueue));
      this.messageQueue = [];
      this.messageTimer = null;
      this.sendState = this.CLOSING;

      return cb(true);
    }
  }
  cb(false);

  // if(this.messageQueue.length && !this.messageTimer) {
  //   console.log('start a timer');
  //   this.messageTimer = setTimeout(this.checkAndSendMessages.bind(this), 200);
  // } else {
  //   this.messageTimer = null;
  // }
};

