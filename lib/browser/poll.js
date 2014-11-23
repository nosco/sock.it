var SockItPoll = function(url) {
  if(!(this instanceof SockItPoll)) return new SockItPoll();

  this.initialConnectionDone = false;
  this.retryTimeout          = 0;

  this.CONNECTING            = 0;           // const readyState state
  this.OPEN                  = 1;           // const readyState state
  this.CLOSING               = 2;           // const readyState state
  this.CLOSED                = 3;           // const readyState state
  this.readyState            = this.CLOSED; // readonly

  this.url                   = url.replace(/^ws/i, 'http');

  this.startPoll();

  this.messageQueue = [];
};

SockItPoll.prototype.triggerEvent = function(eventName) {
  sockit.debug.client('TRIGGER EVENT: on'+eventName);
  if(this['on'+eventName]) {
    var args = Array.prototype.slice.call(arguments, 1);
    this['on'+eventName].apply(this, args);
  }
};

// @todo imitate the close codes from WebSockets
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
  if(!this.retryTimeout) return this._openPoll();

  setTimeout(function() {
    this._openPoll();
  }.bind(this), this.retryTimeout);
};

SockItPoll.prototype._openPoll = function() {
  sockit.debug.conn('Trying to open poll connection');

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
  var xhr = new SockItXHR(true);

  xhr.onopen = function() {
    sockit.debug.xhr('Event: open');

    this.readyState = this.OPEN;
    // @todo Only trigger open, when it's the first open event
    if(!this.initialConnectionDone) {
      this.initialConnectionDone = true;
    }

    this.triggerEvent('open');
  }.bind(this);

  xhr.ondone = function(strDataArray) {
    sockit.debug.xhr('Event: done');

    this.retryTimeout = 0;

    this.readyState = this.CONNECTING; // Start reconnecting

    if(strDataArray === 'poll-start') {
      // This is a reconnect message
      // @todo If this is a response to a poll-msg, then it need to retry

    } else {
      sockit.debug.xhr('Raw data received');
      sockit.debug.xhr(strDataArray);

      var arrData = JSON.parse(strDataArray);

      sockit.debug.xhr('Parsed data received');
      sockit.debug.xhr(arrData);

      for(var i in arrData) {
        this.triggerEvent('message', { type: 'message', data: arrData[i] });
      }
    }

  }.bind(this);

  xhr.onaborted = function() {
    this.retryTimeout = 0;
  }.bind(this);

  xhr.onerror = function() {
    if(!this.retryTimeout) this.retryTimeout = 100;

    this.retryTimeout = Math.ceil(this.retryTimeout * 1.5);
    // Making sure, we don't start waiting forever
    if(this.retryTimeout > 10000) this.retryTimeout = 10000;
  }.bind(this);

  xhr.onclose = function() {
    sockit.debug.xhr('Event: close');
    // this.readyState = this.CLOSED;
    this.readyState = this.CONNECTING;
    this.openPoll();

    // this.triggerEvent('close', arguments);
  }.bind(this);

  this.connection = xhr.post(url);
};

SockItPoll.prototype.send = function(msg) {
  // this.readyState = this.CONNECTING;
  this.messageQueue.push(msg);

  // Pile up messages
  setTimeout(this.sendMessages.bind(this), 0);
};

SockItPoll.prototype.sendMessages = function() {
  if(this.messageQueue.length) {
    var messages = JSON.stringify(this.messageQueue.splice(0, this.messageQueue.length));

    var url = this.url + 'poll-msg';
    var xhr = new SockItXHR();

    sockit.debug.client('Sending message');
    sockit.debug.client(messages);

    xhr.post(url, messages);
  }
};

// SockItPoll.prototype.sendBlob = function() { };
// SockItPoll.prototype.sendArrayBuffer = function() { };
// SockItPoll.prototype.sendArrayBufferView = function() { };
