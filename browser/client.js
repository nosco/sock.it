(function() {

if(!Function.prototype.bind) {
  Function.prototype.bind = function(oThis) {
    if(typeof this !== "function") {
      // closest thing possible to the ECMAScript 5 internal IsCallable function
      throw new TypeError("Function.prototype.bind - what is trying to be bound is not callable");
    }

    var aArgs = Array.prototype.slice.call(arguments, 1);
    var fToBind = this;
    var fNOP = function () {};
    var fBound = function () {
      return fToBind.apply(this instanceof fNOP && oThis ? this : oThis,
                           aArgs.concat(Array.prototype.slice.call(arguments)));
    };

    fNOP.prototype = this.prototype;
    fBound.prototype = new fNOP();

    return fBound;
  };
}
var SockItXHR = function() {
  if(!(this instanceof SockItXHR)) return new SockItXHR();

  this.httpRequest                    = this.getHttpRequestObject();
  this.httpRequest.onreadystatechange = this._readystatechange.bind(this);

  this.readyState                     = this.httpRequest.readyState;

  this.UNSENT                         = 0; // open() has not been called yet.
  this.OPENED                         = 1; // send() has not been called yet.
  this.HEADERS_RECEIVED               = 2; // send() has been called, and headers and status are available.
  this.LOADING                        = 3; // Downloading; responseText holds partial data.
  this.DONE                           = 4; // The operation is complete.
};

SockItXHR.prototype.triggerEvent = function(eventName) {
  if(this['on'+eventName]) {
    var args = Array.prototype.slice.call(arguments, 1);
    this['on'+eventName].apply(this, args);
  }
};

SockItXHR.prototype.getHttpRequestObject = function() {
  if(window.XMLHttpRequest) { // Mozilla, Safari, ...
    httpRequest = new XMLHttpRequest();
  } else if(window.ActiveXObject) { // IE
    try { httpRequest = new ActiveXObject("Msxml2.XMLHTTP");
    } catch (e) {
      try { httpRequest = new ActiveXObject("Microsoft.XMLHTTP"); }
      catch (e) {}
    }
  }

  if(!httpRequest) {
    throw new Error('Unable to create XLM HTTP request');
    return false;
  }

  return httpRequest;
};

SockItXHR.prototype.onreadystatechange = null;
SockItXHR.prototype.ondone             = null;
SockItXHR.prototype.onopen             = null;
SockItXHR.prototype.onheadersreceived  = null;
SockItXHR.prototype.onloading          = null;
SockItXHR.prototype.ondone             = null;
SockItXHR.prototype.onerror            = null;
SockItXHR.prototype.onclose            = null;
SockItXHR.prototype.onmessage          = null;

// Going to use this as the event handler - don't want to deal with all kinds
// of event handling mechanisms used in different browsers
SockItXHR.prototype._readystatechange = function() {
  if(this.httpRequest.readyState === this.OPENED) {
    // Actually connecting as the send hasn't been called yet
    this.triggerEvent('open');

  } else if(this.httpRequest.readyState === this.HEADERS_RECEIVED) {
    // The poll stops already at opened
  } else if(this.httpRequest.readyState === this.LOADING) {
    // The poll stops already at opened
  } else if(this.httpRequest.readyState === this.DONE) {

    if(this.httpRequest.status === 200) {
      this.triggerEvent('message', this.httpRequest.responseText);
      this.triggerEvent('done', this.httpRequest.responseText);

    } else {
      // This is probably a crash
      var err = new Error('Connection failed with HTTP code: '+this.httpRequest.status);
      this.triggerEvent('error', err);
      this.triggerEvent('close');
    }
  }

  this.triggerEvent('readystatechange', arguments);
};

SockItXHR.prototype.post = function(url, post) {
  this.httpRequest.open('POST', url, true);
  this.httpRequest.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
  this.httpRequest.send(post);
};

SockItXHR.prototype.get = function(url) {
  this.httpRequest.open('GET', url, true);
  this.httpRequest.send();
};
var SockItPoll = function(url) {
  if(!(this instanceof SockItPoll)) return new SockItPoll();

  this.CONNECTING = 0;           // const readyState state
  this.OPEN       = 1;           // const readyState state
  this.CLOSING    = 2;           // const readyState state
  this.CLOSED     = 3;           // const readyState state
  this.readyState = this.CLOSED; // readonly

  this.url        = url.replace(/^ws/i, 'http');

  this.connId     = null;

  this.startPoll();
};

SockItPoll.prototype.triggerEvent = function(eventName) {
  if(this['on'+eventName]) {
    var args = Array.prototype.slice.call(arguments, 1);
    this['on'+eventName].apply(this, args);
  }
};

SockItPoll.prototype.onopen    = null;
SockItPoll.prototype.onclose   = null;
SockItPoll.prototype.onmessage = null;
SockItPoll.prototype.onerror   = null;

// ONLY CALL THE "FINAL" ONCLOSE, WHEN IT IS NOT A "PING/PONG"-ISH RECONNECT

SockItPoll.prototype.startPoll = function() {
  this.readyState = this.CLOSED;

  var url = this.url + 'poll-start';
  var xhr = new SockItXHR();

  xhr.ondone = function(data) {
    this.readyState = this.CONNECTING; // Start reconnecting

    if(data && data.length > 0) {
      this.connId = data;
      this.openPoll();
    } else {
      throw new Error('No connection received');
    }
  }.bind(this);

  xhr.onerror = function() {
    this.readyState = this.CLOSED;
    // @todo figure out what is actually send along and what to pass along...
    this.triggerEvent('error', {}, arguments);
    this.triggerEvent('close', {}, arguments);
  }.bind(this);

  xhr.post(url);
};

SockItPoll.prototype.openPoll = function() {
  // @todo figure out when a connection is properly closed
  //   Maybe we should just decide, that a connection is properly closed, when
  //   the server sends a close statement?

  // We need to NOT use jQuery, if we are to make sure, the connection is really
  // open, when we call the onopen!..

  // Check what kind of data is being send by websockets for each event handler
  // and try to match it...
  // UPDATE: at least make sure, the first argument is an "event" object

  this.readyState = this.CONNECTING;

  var url = this.url + 'poll';
  var xhr = new SockItXHR();

  xhr.onopen = function() {
    this.readyState = this.OPEN; // Start reconnecting
    this.triggerEvent('open');
  }.bind(this);

  xhr.ondone = function(data) {
    this.readyState = this.CONNECTING; // Start reconnecting
    this.triggerEvent('message', {}, data);
    this.openPoll();
  }.bind(this);

  xhr.onerror = function() {
    this.readyState = this.CLOSED;
    // @todo figure out what is actually send along and what to pass along...
    this.triggerEvent('error', arguments);
    this.triggerEvent('close', arguments);
  }.bind(this);

  this.connection = xhr.post(url);
};

SockItPoll.prototype.send = function(msg) {
  var url = this.url + 'poll-msg';

  var xhr = new SockItXHR();

  xhr.post(url, msg);
};

// SockItPoll.prototype._sendBlob = function() { };
// SockItPoll.prototype._sendArrayBuffer = function() { };
// SockItPoll.prototype._sendArrayBufferView = function() { };
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


/* @TODO
 * - create a close function
 * - create a send function
 */

var SockIt = function(settings) {
  if(!(this instanceof SockIt)) return new SockIt(url, protocols);

  this.transport             = null;
  this.initialConnectionDone = false;

  settings                   = settings     || {};
  this.url                   = settings.url || '/sock.it/'; // readonly - should be a full path or break

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
    this.readyState = this.transport.readyState;
    this.triggerEvent('message', arguments);
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

window.SockIt = SockIt;
})();

