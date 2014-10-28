var util = require("util");
var events = require("events");

var PollClient = function(info) {
  events.EventEmitter.call(this);
  this.setMaxListeners(0);

  this.initialConnectionDone = false;
  this.connectionOpened      = false;

  this.messageQueue = [];
  for(var i in info) this[i] = info[i];

  this.messageTimer = null;

  this.OPENING   = 0;
  this.WAITING   = 1;
  this.SENDING   = 2;
  this.sendState = this.OPENING;
};
util.inherits(PollClient, events.EventEmitter);
module.exports = PollClient;

PollClient.prototype.initConnection = function(request, response) {
  this.sendState = this.OPENING;
  this.lastActivity = new Date();

  var now = new Date();
  var cookieExpires = now.setTime(now.getTime() + (this.config.cookieTimeout * 1000));

  var cookieStr = [
    this.config.cookieName, '=', this.connId, '; ',
    'expires=', now.toGMTString(), '; ',
    'path=', this.config.path, '; ',
    'secure', 'httpOnly', '; '
  ].join('');

  response.writeHead(200, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'Set-Cookie': cookieStr
  });

  var msg = 'connId='+this.connId;

  // @todo make sure, there isn't a race condition between end and the attach on the client

  this.emit('connection', this);

  response.end(msg);
  this.initialConnectionDone = true;
};


PollClient.prototype.openConnection = function(request, response) {
  this.sendState = this.OPENING;
  this.lastActivity = new Date();
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

  this.checkAndSendMessages();
};

// @todo this should be moved to the client and it should filter on the cookie
PollClient.prototype.receiveMessage = function(request, response) {
  this.lastActivity = new Date();
// console.log('POLL: receiveMessage');

  if(request.method == 'POST') {
    var body = '';
    request.on('data', function(data) {
      body += data;

      // // Too much POST data, kill the connection!
      // Yeah but... what does that do - should we treat it as an error?
      // if (body.length > 1e6)
      //     req.connection.destroy();
    }.bind(this));

    request.on('end', function () {
      // var post = qs.parse(body);
      this.emit('message', body);
      response.end();
    }.bind(this));
  }
};

PollClient.prototype.send =
PollClient.prototype.sendMessage = function(msg) {
  this.messageQueue.push(msg);
  this.checkAndSendMessages();
};

PollClient.prototype.checkAndSendMessages = function() {
  this.lastActivity = new Date();

  // @todo check for closed, connection, etc.
  if(this.sendState === this.WAITING && this.messageQueue.length) {
    if( this.response && !this.response.finished && this.response.end) {
      // @todo there should probably be some error checks like the websocket does it

      var count = this.messageQueue.length;
      var messagesToSend = this.messageQueue.splice(0, count);

      // this.response.on('error', function() {
      //   console.log('CAUGHT A RESPONSE ERROR!..');
      // });

      this.response.end(JSON.stringify(messagesToSend));
      this.sendState = this.OPENING;
      this.messageTimer = null;
    }
  }

  if(this.messageQueue.length && !this.messageTimer) {
    this.messageTimer = setTimeout(this.checkAndSendMessages.bind(this), 200);
  } else {
    this.messageTimer = null;
  }
};

