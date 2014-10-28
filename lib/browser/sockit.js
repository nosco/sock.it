/* Things to consider
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
 * *
 * Possible pitfalls
 * - If long-polling in IE < 10 + Chrome < 13 is buggy - try 2kb "padding"
 * - Lots of SO_KEEPALIVE of 30 - 45 secs, so use a heartbeat of <= 30
 *     Maybe it is possible to create a clever timer, that only sets a timer
 *     when it experiences an uncontrolled connection close?
 *     Pitfall: Is it possible the connection could disappear silently?
 */

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


/* @TODO WE NEED TO MAKE SURE, THAT JSON IS AVAILABLE! */

var SockIt = function(settings) {
  if(!(this instanceof SockIt)) return new SockIt(url, protocols);

  this.transport             = null;
  this.initialConnectionDone = false;

  this.settings              = settings          || {};
  this.url                   = this.settings.url || '/sock.it/'; // readonly - should be a full path or break

  this.CONNECTING            = 0;           // const readyState state
  this.OPEN                  = 1;           // const readyState state
  this.CLOSING               = 2;           // const readyState state
  this.CLOSED                = 3;           // const readyState state
  this.readyState            = this.CLOSED; // readonly

  this.bufferedAmount        = 0;           // readonly
  this.extensions            = "";          // readonly
  this.protocol              = "";          // readonly - should be one of protocols or empty
  this.binaryType            = "blob";      // No binaries for now

  this.setupConf();
  this.initiateConnection();
};

SockIt.prototype.triggerEvent = function(eventName) {
  if(this['on'+eventName]) {
    var args = Array.prototype.slice.call(arguments, 1);
    this['on'+eventName].apply(this, args);
  }
};

// @todo This should be implemented in the poll code!
// Check: http://dev.w3.org/html5/websockets/#dom-websocket-close
// SockIt.prototype.close = function(code) {
// //If the method's first argument is present but is neither an integer equal to 1000 nor an integer in the range 3000 to 4999, throw an InvalidAccessError exception and abort these steps.
// };

SockIt.prototype.onopen    = null;
SockIt.prototype.onclose   = null;
SockIt.prototype.onmessage = null;
SockIt.prototype.onerror   = null;

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

SockIt.prototype.open =
SockIt.prototype.initiateConnection = function() {
  if(this.transportType === 'websocket') {
    this.openWebSocketConnection(this.url);

  } else if(this.transportType === 'poll') {
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

// @todo this could be prettier
SockIt.prototype.send = function(msg) {
  this.transport.send(msg);
};

SockIt.prototype.setupTransportReferences = function() {
  this.transport.onopen = function() {
    this.initialConnectionDone = true;
    this.readyState = this.transport.readyState;
    this.triggerEvent('open', arguments);
  }.bind(this);

  this.transport.onmessage = function() {
    var args = Array.prototype.slice.call(arguments);
    args.unshift('message');

    this.readyState = this.transport.readyState;
    this.triggerEvent.apply(this, args);
  }.bind(this);

  this.transport.onclose = function() {
    if(!this.initialConnectionDone && this.transportType === 'websocket') {
      this.openPollConnection();

    } else {
      this.readyState = this.transport.readyState;
      this.triggerEvent('close', arguments);
    }

  }.bind(this);

  this.transport.onerror = function() {
    this.readyState = this.transport.readyState;
    this.triggerEvent('error', arguments);
  }.bind(this);
};
