var SockItPoll = function() {
  if(!(this instanceof SockItPoll)) return new SockItPoll();
};


// ONLY CALL THE "FINAL" ONCLOSE, WHEN IT IS NOT A "PING/PONG"-ISH RECONNECT


SockItPoll.prototype.openPoll = function() {
  console.log('open poll');

  if(!this.initialConnectionDone || !this.connId) {
    this._startPoll();

  } else {
    this._openPoll();
  }

  // this.connection = new WebSocket(connectionUrl);
  // this.connection.onopen = this._onOpen.bind(this);
  // this.connection.onclose = this._onClose.bind(this);
  // this.connection.onerror = this._onError.bind(this);
  // this.connection.onmessage = this._onMessage.bind(this);
};

SockItPoll.prototype._startPoll = function() {
  this.initialConnectionDone = false;
  this.connId = null;

  this.readyState = this.CONNECTING;

  var url = this.url.replace(/^ws/i, 'http') + 'poll-start';
  // Use get?
  // How to discover a close on this one, is it just done???
  $.post(url, {}, null,  "json")
  .done(function(data, status) {
    if(data.connId) {
      this.connId = data.connId;
      this.initialConnectionDone = true;
      this._openPoll();
    }
  }.bind(this))

  .fail(function() {
    console.log('_startPoll req fail');
    console.log(arguments);
  }.bind(this))

  // .always(function() {
  //   console.log('poll req always');
  //   console.log(arguments);
  // }.bind(this));
};

SockItPoll.prototype._openPoll = function() {
  var url = this.url.replace(/^ws/i, 'http') + 'poll';
  // Use get?
  // How to discover a close on this one, is it just done???

  this.conn = $.post(url, {}, null,  "json")
  .done(function(data, status) {
    // This is when data comes it, re-open, right?
    console.log(arguments);
    this.readyState = this.CONNECTING;
    this._openPoll();
  }.bind(this))

  // .always(function() {
  //   console.log('_openPoll always');
  //   console.log(arguments);
  // }.bind(this))

  .fail(function() {
    console.log('_openPoll req fail');
    console.log(arguments);
  }.bind(this))

  .progress(function() {
    console.log('_openPoll progress');
    console.log(arguments);
  }.bind(this))


  this.readyState = this.OPEN;
  // this.send('HEY YO');


// console.log(this.conn);

//   setInterval(function() { console.log('readyState:'); console.log(this.conn.readyState); }.bind(this), 1000);
//   setInterval(function() { console.log('state:'); console.log(this.conn.state()); }.bind(this), 1000);
//   setInterval(function() { console.log('statusCode:'); console.log(this.conn.statusCode()); }.bind(this), 1000);

// abort
// progress
// readyState
// state
// statusCode

};

SockItPoll.prototype.send = function(msg) {
  var url = this.url.replace(/^ws/i, 'http') + 'poll-msg';
  $.post(url, { msg: msg }, null,  "json");
};


SockItPoll.prototype._onOpen = function(e) {
  console.log('on open');
  this.initialConnectionDone = true;
};

SockItPoll.prototype._onClose = function(e) {
  console.log('on close');
  if(!this.initialConnectionDone && this.transportType === 'websocket') {
    // @todo this should only happen, if websocket has never opened
    // otherwise it should just reconnect, as the server could have been restarted
    console.log('retry with polling');
    this.transportType = 'poll';
    this.openPoll();
  }
};

SockItPoll.prototype._onError = function(e) {
  console.log('on error');
  console.log(arguments);
};

SockItPoll.prototype._onMessage = function(e) {
  console.log('on message');
  var msg = e.data;
  console.log(msg);
  // this.send('Thank you!');
};


SockItPoll.prototype.close = function() {
};

// SockItPoll.prototype.send = function(data) {
//   this.connection.send(data);
// };

SockItPoll.prototype._sendString = function() {
};

SockItPoll.prototype._sendBlob = function() {
};

SockItPoll.prototype._sendArrayBuffer = function() {
};

SockItPoll.prototype._sendArrayBufferView = function() {
};/* Things to consider
 * - Do we want to expect pings from the server? UPDATE: Yes! Websocket standard thingy
 *     The clients websocket will take care of responses to pings
 *     Should this be done for polling? It wouldn't make sense, as the connection
 *     would have to be shut down, unless it's possible to go back to the very
 *     first version I did years and years ago - streaming polling
 * - How to detect a non correctly closed connection AND recover from it?
 *
 * Things to code by
 * - Minimal wrapper around the WebSocket API
 * - Etxendable - don't add stuff to the basic API, make it directly extendable
 * - Any extensions in the "upper" layer, should also work directly on WebSocket
 * - Should polling send as many messages at a time as possible?
 * - Should we expect any messages through poll to be an array of messages?
 * - Eventually support all message types: String, Blob, ArrayBuffer, ArrayBufferView
 *
 * Some thoughts
 * - It should not be necessary to send results through redis pub/sub
 *     Instead the request goes through pub/sub and is catched by 1 process,
 *     which finally sends the answer directly
 *
 * Polling
 * - Keep a connection open
 * - Send a request with a message id
 * - When a message is received on the client, close the long-poll connection
 *     and open a new
 *
 * Possible pitfalls
 * - If long-polling in IE < 10 + Chrome < 13 is buggy - try 2kb "padding"
 * - Lots of SO_KEEPALIVE of 30 - 45 secs, so use a heartbeat of <= 30
 *     Maybe it is possible to create a clever timer, that only sets a timer
 *     when it experiences an uncontrolled connection close?
 *     Pitfall: Is it possible the connection could disappear silently?
 */

/* MAKE SURE WE CAN FETCH JQUERY, IF IT IS NOT ALREADY AVAILABLE !!! */

/*
  WS API
  readonly attribute DOMString url;

  // ready state
  const unsigned short CONNECTING = 0;
  const unsigned short OPEN = 1;
  const unsigned short CLOSING = 2;
  const unsigned short CLOSED = 3;
  readonly attribute unsigned short readyState;
  readonly attribute unsigned long bufferedAmount;

  // networking
           attribute EventHandler onopen;
           attribute EventHandler onerror;
           attribute EventHandler onclose;
  readonly attribute DOMString extensions;
  readonly attribute DOMString protocol;
  void close([Clamp] optional unsigned short code, optional DOMString reason);

  // messaging
           attribute EventHandler onmessage;
           attribute BinaryType binaryType;
  void send(DOMString data);
  void send(Blob data);
  void send(ArrayBuffer data);
  void send(ArrayBufferView data);
 */


/* TODO:
 * - Figure how to take over /sock.it/* on both standard http and express
 * - How to "store" clients
 * - How to utilize redis - probably subscribe to "domain room" and "domain user"
 * - Don't start a redis client pr user - do it pr process
 */

var SockIt = function(settings) {
  if(!(this instanceof SockIt)) return new SockIt(url, protocols);

  this.transport             = null;
  this.initialConnectionDone = false;

  settings                   = settings     || {};
  this.url                   = settings.url || '/sock.it/'; // readonly - should be a full path or break

  // // Is this needed? (at least for now?)
  // this.protocols      = protocols || [];
  // if(typeof this.protocols === 'string') {
  //   this.protocols    = [this.protocols]; // Right?
  // }

  this.CONNECTING            = 0;           // const readyState state
  this.OPEN                  = 1;           // const readyState state
  this.CLOSING               = 2;           // const readyState state
  this.CLOSED                = 3;           // const readyState state
  this.readyState            = this.CLOSED; // readonly

  this.bufferedAmount        = 0;           // readonly
  this.extensions            = null;        // readonly
  this.protocol              = null;        // readonly - should be one of protocols or empty
  this.binaryType            = null;        // No binaries for now

  this.setupConf();
  this.initiateConnection();
};

// UNDER CONSIDERATION:
// for(var i in SimpleEvents.prototype) {
//   SockIt.prototype[i] = SimpleEvents.prototype[i];
// }


// @todo This should be implemented in the poll code!
// Check: http://dev.w3.org/html5/websockets/#dom-websocket-close
// SockIt.prototype.close = function(code) {
// //If the method's first argument is present but is neither an integer equal to 1000 nor an integer in the range 3000 to 4999, throw an InvalidAccessError exception and abort these steps.
// };


// Though the basic philisophy is to NOT add to the WebSocket, it should be
// considered if "real" events (emit) is fair to add?
SockIt.prototype.onopen = function() {};
SockIt.prototype.onclose = function() {};
SockIt.prototype.onmessage = function() {};
SockIt.prototype.onerror = function() {};

SockIt.prototype.setupConf = function() {
  this.transportType = 'websocket'; // websocket or poll

  if(this.url.match(/(http|https|ws|wss):\/\//i)) {
    this.url = this.url.replace(/^http/i, 'ws');

  } else {
    this.url = this.url.replace(/^\.+\//i, '');
    this.url = this.url.replace(/^([^\/])/i, '/$1');
    this.url = [
      window.location.protocol, '//',
      window.location.host, this.url
    ].join('');
  }

  this.url = this.url.replace(/([^\/])$/i, '$1/');

  // There is probably some more things to test for, on the platforms that
  //   claims to have WebSocket, but doesn't...
  if(!("WebSocket" in window)) {
    this.transportType = 'poll';
  }
};


SockIt.prototype.initiateConnection = function() {
  // If connection type is to be a websocket, then try that, but throw back
  // an error if that doesn't work, so the connection can be set poll
  // ... or something like that...
  if(this.transportType === 'websocket') {
    // Open a websocket connection (transport)
    this.openWebSocketConnection(this.url);
  } else if(this.transportType === 'poll') {
    // Open a poll connection (transport)
    this.openPollConnection(this.url);

  }
};

SockIt.prototype.openWebSocketConnection = function() {
  this.transportType = 'websocket';
  var url = this.url.replace(/^http/i, 'ws');
  this.transport = new WebSocket(url);
  this.setupTransportReferences();
};

SockIt.prototype.openPollConnection = function() {
  this.transportType = 'poll';
  var url = this.url.replace(/^ws/i, 'http');
  this.transport = new SockItPoll(url);
  this.setupTransportReferences();
};

SockIt.prototype.setupTransportReferences = function() {
  this.transport.onopen = function() {
    this.initialConnectionDone = true;
    this.readyState = this.transport.readyState;
    this.onopen.apply(this, arguments);
  }.bind(this);


  this.transport.onmessage = function() {
    this.readyState = this.transport.readyState;
    this.onmessage.apply(this, arguments);
  }.bind(this);

  this.transport.onclose = function() {
    this.readyState = this.transport.readyState;
    this.onclose.apply(this, arguments);
  }.bind(this);

  this.transport.onerror = function() {
    this.readyState = this.transport.readyState;
    this.onerror.apply(this, arguments);
  }.bind(this);
};

SockIt.prototype._reconnect = function() {
  if(!this.initialConnectionDone && this.transportType === 'websocket') {
    this.openPollConnection();

  } else if(this.transportType === 'websocket') {
    this.openWebSocketConnection();
    // RECONNECT WITH PULL BACK TIMING - IF ALLOWED

  } else if(this.transportType === 'poll') {
    // RECONNECT WITH PULL BACK TIMING - IF ALLOWED
    this.openPollConnection();
  }
};

