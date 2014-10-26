var qs = require('querystring');
var Cookies = require('cookie-tools');
var uuid = require('node-uuid');
var path = require('path');
var read = require('fs').readFileSync;
var browserLibrarySource = read(path.normalize(__dirname + '../../../browser/client.js'), 'utf-8');
var browserLibraryVersion = require('../../package').version;

var PollClient = require('./poll-client');

// @todo CHECK WHAT EVENTS WS HAS AND "REPLICATE"

var PollServer = function(httpServer, config) {
  this.clients = [];
  this.clientsReversed = {};

  this.httpServer = httpServer;
  this.config = config;
  this.attach();
};
exports.Server = PollServer;
exports.Client = PollClient;

PollServer.prototype.attach = function() {  console.log('poll attach');
  this.requestListeners = this.httpServer.listeners('request').slice(0);
  this.httpServer.removeAllListeners('request');
  this.httpServer.on('request', this.onRequest.bind(this));
};

/**
 * Handle all requests on the server object
 * @param  {object} request  http request
 * @param  {object} response http response
 */
PollServer.prototype.onRequest = function(request, response) {
  // Check if this is a request for sock.it
  if(request.url.indexOf(this.config.path) !== 0) {
    for(var i=0 ; i < this.requestListeners.length ; i++) {
      this.requestListeners[i].call(this.httpServer, request, response);
    }
    return;
  }

  var url = request.url.replace(this.config.path, '');
console.log(url);
  if(url === 'client.js') {
    this.serveClient(request, response);

  } else if(url === 'poll-msg') {
    this.receiveMessage(request, response);

  } else if(url === 'poll') {
    this.openConnection(request, response);

  } else if(url === 'poll-start' || url === '') {
    this.initConnection(request, response);

  } else {
    console.log('What to do then?');
  }
};

PollServer.prototype.initConnection = function(request, response) {
  var connId = this._generateId();

  // @todo figure out, whether we want to use cookies or not...
  // What about just putting it in the url?

  // Maybe use cookieTools here?

  var now = new Date();
  var cookieExpires = now.setTime(now.getTime() + (this.config.cookieTimeout * 1000));
  var cookieStr = [
    this.config.cookieName, '=', connId, '; ',
    'expires=', now.toGMTString(), '; ',
    'path=', this.config.path, '; ',
    'secure', 'httpOnly', '; '
  ].join('');

  response.writeHead(200, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'Set-Cookie': cookieStr
  }); // No JSON for IE8?..

  var msg = connId;

  response.end(this.safePollMessage(msg));
};


PollServer.prototype.openConnection = function(request, response) {
  // It would be possible to send a request from client to server in this
  // request - just look for something in the body...

  // if connId exists create a new client
  if(request.headers.cookie) {
    var cookies = new Cookies(request.headers.cookie);

    response.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    }); // No JSON for IE8?..

    var client = new PollClient({
      request: request,
      response: response,
      connId: cookies[this.config.cookieName].value,
    });

    var index = this.clients.push(client);
    this.clientsReversed[cookies[this.config.cookieName].value] = (index-1);

    // client.send('testing');

  } else {
    // @todo decline (or send a poll-start response?)
  }

  // console.log(request.headers.cookie);
};




PollServer.prototype.receiveMessage = function(request, response) {
  if(request.method == 'POST') {
    var body = '';
    request.on('data', function(data) {
      body += data;

      // // Too much POST data, kill the connection!
      // Yeah but... what does that do - should we treat it as an error?
      // if (body.length > 1e6)
      //     req.connection.destroy();
    });
    request.on('end', function () {
      var post = qs.parse(body);
      console.log('received a message');
      console.log(post);
      response.end();
    });
  }
};


PollServer.prototype.safePollMessage = function(str) {
  var tmpStr = '';
  if(typeof str !== 'string') {
    tmpStr = JSON.stringify(str);
  } else {
    tmpStr = str;
  }

  // Is this needed?
  // if(tmpStr.length < 2048) {
  //   tmpStr = tmpStr + new Array(2048 - tmpStr.length).join(' ');
  // }
  // return 'a[' + tmpStr + '];';
  return tmpStr;
};


/**
 * Serve the client library
 * @param  {object} request  http request
 * @param  {object} response http response
 */
PollServer.prototype.serveClient = function(request, response) {
  // For now, just serve the file directly from disk
  //   anything else slows down the workflow

  var browserLibrarySource = read(path.normalize(__dirname + '../../../browser/client.js'), 'utf-8');
  var browserLibraryVersion = new Date().getTime();

  var ifNoneMatch = request.headers['if-none-match'];
  if(ifNoneMatch && ifNoneMatch === browserLibraryVersion) {
    response.writeHead(304);
    response.end();
    return;
  }

  response.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  // Yay node, express and whatever...
  // This is the ONLY way I got ETag to work.......
  response.setHeader('ETag', browserLibraryVersion);
  response.writeHead(200, { etag: browserLibraryVersion });
  response.end(browserLibrarySource);
};


PollServer.prototype._generateId = function() {
  return uuid.v1();
};
