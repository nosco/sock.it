var util = require("util");
var events = require("events");

// This will act like a middleware that has no awareness of connections
// It will handle talking to whoever got the first (poll-start) request
// After that, there messaging back and forth is handled in e.g. redis
// There should be a way of ensuring, this dies, when the client is removed
// from redis - this way it should self-destruct, but we also need to make sure
// there isn't more than 1 process handling the communication for 1 browser
var PollClient = function(request, response, clientInfo, relay) {
  events.EventEmitter.call(this);
  this.setMaxListeners(0);

  this.CONNECTING             = 0;               // const readyState state
  this.OPEN                   = 1;               // const readyState state
  this.CLOSING                = 2;               // const readyState state
  this.CLOSED                 = 3;               // const readyState state
  this.readyState             = this.CONNECTING; // readonly

  //@todo maybe we should ensure that a timer will emit close, if not stopped
  //and updated regularly? It should at least be possible to get an event, when
  // new poll requests are coming in, right?

  this.clientInfo = clientInfo;
  this.relay = relay;

  this.upgradeReq = { headers: {} };

  for(var i in request.headers) {
    this.upgradeReq.headers[i] = request.headers[i];
  }

  this.send = this.relay.send.bind(this.relay, clientInfo.connId)

  this.setupListeners();
};
util.inherits(PollClient, events.EventEmitter);
module.exports = PollClient;

PollClient.prototype.setupListeners = function() {
  // Listen for receive messages (that is: messages from the browser)
  this.readyState = this.OPEN;
  this.relay.on('sock.it:receiveQueue::'+this.clientInfo.connId, this.receive.bind(this));
  this.relay.on('sock.it:clientClose::'+this.clientInfo.connId, this.close.bind(this));
  this.receive();
};

// // SERVER -> BROWSER - This going to be FROM the server TO the browser
// // Let the relay handle this
// PollClient.prototype.send = function() {
// };

PollClient.prototype.receive = function() {
  debug.msgIn('Fetching receive messages:');
  this.relay.getReceiveMessages(this.clientInfo.connId, function(err, res) {
    if(!err && res) {
      for(var i in res) {
        debug.msgIn('Emit message event with message:');
        debug.msgIn(res[i]);
        this.emit('message', res[i]);
      }
    }
  }.bind(this));
};

PollClient.prototype.close = function() {
  // Remember to detach and stuff
  console.log('PollClient:close called');
  this.relay.removeListener('sock.it:receiveQueue::'+this.clientInfo.connId, this.receive.bind(this));
  this.relay.removeListener('sock.it:clientClose::'+this.clientInfo.connId, this.close.bind(this));
  this.emit('close');
};

