var util = require("util");
var events = require("events");
var qs = require('querystring');
var PollClient = require('./poll-client');

// @todo CHECK WHAT EVENTS WS HAS AND "REPLICATE"

var PollTransport = function(httpServer, config) {
  events.EventEmitter.call(this);
  this.setMaxListeners(0);

  for(var i in config) this[i] = config[i];

  this.pathRegExp = new RegExp(this.path+'(?:/|)(.+?|)/(poll.*|)$');

  this.config = config;

  this.clientsByConnId = {};

  this.httpServer = httpServer;
  this.clientsByConnId = {};
  this.attach();
};
util.inherits(PollTransport, events.EventEmitter);

exports.Server = PollTransport;
exports.Client = PollClient;

PollTransport.prototype.attach = function() {
  this.requestListeners = this.httpServer.listeners('request').slice(0);
  this.httpServer.removeAllListeners('request');
  this.httpServer.on('request', this.onRequest.bind(this));
};

/**
 * Handle all requests on the server object
 * @param  {object} request  http request
 * @param  {object} response http response
 */
PollTransport.prototype.onRequest = function(request, response) {
  // This has nothing to do with Sock.It - let somebody else worry about that!
  request.host = request.headers.host;

  // If anything but the sock.it path, then call all the other listeners
  if(request.url.indexOf(this.path) === 1) {
    for(var i=0 ; i < this.requestListeners.length ; i++) {
      this.requestListeners[i].call(this.httpServer, request, response);
    }

  } else {

    var connId = null;
    var clientInfo = null;

    var match = this.pathRegExp.exec(request.url));

    if(match) {
      connId = match[1] || null;
      requestPath = match[2] || 'poll-start'; // Should we rather just throw an error?
    }

    if(connId) {
      clientInfo = relay.getClientInfo
    }


    if(!clientInfo || requestPath === 'poll-start') {
      // If we have no info on the client, we treat this is a start request
      relay.createClient
      send poll start

    } else if(requestPath + 'poll') {
      relay.handlePoll

    } else if(requestPath + 'poll-msg') {
      relay.receiveMessage

    } else {
      die hard, ultra mega superman hard
    }





    this.relay.handleRequest(request, response, function(action, clientInfo, pollClient) {
      if(action === 'poll-msg') {
        var pollClient = new PollClient(clientInfo, {
          config:       this.config,
          lastActivity: new Date(),
          request:      request,
          response:     response,
        });

        pollClient.send = this.relay.handleMessage.bind(this.relay, pollClient.client);

        for(var i in this.config) pollClient[i] = this.config[i];

        this.emit('connection', pollClient);

        // this.relay.addPollClient(pollClient);

        // pollClient.on('connection', this.emit.bind(this, 'connection'));

        pollClient.receiveMessage(request, response);

      } else if(action === 'poll') {
        var pollClient = new PollClient(clientInfo, {
          config:   this.config,
          request:  request,
          response: response,
        });
        for(var i in this.config) pollClient[i] = this.config[i];

        this.relay.addPollClient(pollClient);

        pollClient.openConnection(request, response);

      } else if(action === 'poll-start') {
        this.sendPollStart(request, response);
      }
    }.bind(this));
  }

};

PollTransport.prototype.sendPollStart = function(request, response) {
  // this.relay.clientsCleanup(); ?
  var connId = null;

  var client = this.relay.createClient({
    host: request.headers.host,
    connId: connId
  }, function(err, client) {

    var pollClient = new PollClient(client, {
      host:     this.host,
      config:   this.config,
      request:  request,
      response: response,
    });
    for(var i in this.config) pollClient[i] = this.config[i];

    pollClient.initConnection(request, response);
  }.bind(this));
};

