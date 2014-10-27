var util = require("util");
var events = require("events");

var PollClient = function(info) {
  this.messageQueue = [];
  for(var i in info) this[i] = info[i];
};
util.inherits(PollClient, events.EventEmitter);
module.exports = PollClient;

PollClient.prototype.openConnection = function(request, response) {
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

  if(this.messageQueue.length) {
    response.end(this.messageQueue.shift());

  } else {
    this.emit('connection', this);
  }

};

// @todo this should be moved to the client and it should filter on the cookie
PollClient.prototype.receiveMessage = function(request, response) {
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
  // @todo check for closed, connection, etc.
  // set readyState to closing

  this.messageQueue.push(msg);

  if(!this.response || !this.response.finished) {
    this.response.end(this.messageQueue.shift());
  }
};
