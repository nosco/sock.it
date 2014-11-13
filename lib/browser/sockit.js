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

  settings                    = settings       || {};

  this._transport             = null;
  this._transportType         = 'websocket';
  this._initialConnectionDone = false;

  this.url                    = settings.url   || '/sock.it/'; // readonly - should be a full path or break
  this.URL                    = this.url;

  this.CONNECTING             = 0;             // const readyState state
  this.OPEN                   = 1;             // const readyState state
  this.CLOSING                = 2;             // const readyState state
  this.CLOSED                 = 3;             // const readyState state
  this.readyState             = this.CLOSED;   // readonly

  this.bufferedAmount         = 0;             // readonly
  this.extensions             = "";            // readonly
  this.protocol               = "";            // readonly - should be one of protocols or empty
  this.binaryType             = "blob";        // No binaries for now

  this._setupConf();
  this._initiateConnection();
};

// @todo create a proper event system
// SockIt.prototype.addEventListener||attachEvent = function() {};
// SockIt.prototype.dispatchEvent = function() {};
// SockIt.prototype.removeEventListener = function() {};
// SockIt.prototype.close = function() {};

// @todo This should be implemented in the poll code!
// Check: http://dev.w3.org/html5/websockets/#dom-websocket-close
// SockIt.prototype.close = function(code) {
// If the method's first argument is present but is neither an integer equal to
// 1000 nor an integer in the range 3000 to 4999, throw an InvalidAccessError
// exception and abort these steps.
// };
SockIt.prototype.onopen    = null;
SockIt.prototype.onclose   = null;
SockIt.prototype.onmessage = null;
SockIt.prototype.onerror   = null;

// BROWSER <- SERVER This should ONLY be used to trigger events FROM the server TO the browser
SockIt.prototype._triggerEvent = function(eventName) {
  this.debug.client('trigger event: '+eventName);

  if(this['on'+eventName]) {
    var args = Array.prototype.slice.call(arguments, 1);
    this['on'+eventName].apply(this, args);
  }
};

SockIt.prototype._setupConf = function() {
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
    this._transportType = 'poll';
  }

  this.debug = {};
  this.debug.todo = debug('sockit:todo');
  this.debug.todo.color = debug.colors[1];
  this.debug.err = debug('sockit:errors');
  this.debug.err.color = debug.colors[1];
  this.debug.xhr = debug('sockit:xhr');
  this.debug.xhr.color = debug.colors[999];
  this.debug.client = debug('sockit:client');
  this.debug.client.color = debug.colors[3];
  this.debug.conn = debug('sockit:connection');
  this.debug.conn.color = debug.colors[2];
  this.debug.msgIn = debug('sockit:messages in');
  this.debug.msgIn.color = debug.colors[4];
  this.debug.msgOut = debug('sockit:messages out');
  this.debug.msgOut.color = debug.colors[6];
  this.debug.relay = debug('sockit:relay');
  this.debug.relay.color = debug.colors[7];
};

SockIt.prototype._initiateConnection = function() {
  this.debug.conn('Try to open a connection with '+this._transportType);

  if(this._transportType === 'websocket') {
    var url = this.url.replace(/^http/i, 'ws');
    this._transport = new WebSocket(url);

  } else if(this._transportType === 'poll') {
    var url = this.url.replace(/^ws/i, 'http');
    this._transport = new SockItPoll(url);
  }

  this._setupTransportListeners();
};


SockIt.prototype.send = function(msg) {
  this.debug.msgOut('send this should be from browserBackend to server (via XHR)');
  this.debug.msgOut(msg);
  this._transport.send(msg);
};


SockIt.prototype._setupTransportListeners = function() {
  this._transport.onopen = function() {
    this.debug.conn('connection opened with '+this._transportType);
    this.readyState = this._transport.readyState;
    if(!this._initialConnectionDone) {
      this._initialConnectionDone = true;
      this._triggerEvent('open', arguments);
    }
  }.bind(this);

  this._transport.onmessage = function() {
    this.debug.msgIn('received message with '+this._transportType);
    this.debug.msgIn(arguments[0])
    var args = Array.prototype.slice.call(arguments);
    args.unshift('message');

    this.readyState = this._transport.readyState;
    this._triggerEvent.apply(this, args);
  }.bind(this);

  this._transport.onclose = function() {
    if(!this._initialConnectionDone && this._transportType === 'websocket') {
      this._transportType = 'poll';
      this._initiateConnection();

    // This should not be necessary, if poll.js does it's job properly
    // } else if(!this._initialConnectionDone) {
    //   this.readyState = this.CONNECTING;

    } else {
      this.readyState = this._transport.readyState;
      this._triggerEvent('close', arguments);
    }

  }.bind(this);

  this._transport.onerror = function() {
    this.readyState = this._transport.readyState;
    this._triggerEvent('error', arguments);
  }.bind(this);
};
