var SockItPoll = function(url) {
  if(!(this instanceof SockItPoll)) return new SockItPoll();

  this.initialConnectionDone = false;

  this.CONNECTING            = 0;           // const readyState state
  this.OPEN                  = 1;           // const readyState state
  this.CLOSING               = 2;           // const readyState state
  this.CLOSED                = 3;           // const readyState state
  this.readyState            = this.CLOSED; // readonly

  this.url                   = url.replace(/^ws/i, 'http');

  this.startPoll();
};

SockItPoll.prototype.triggerEvent = function(eventName) {
  console.log('TRIGGER EVENT: on'+eventName);
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
    // console.log('openPoll');

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
    console.log('TRIGGER OPEN IN POLL');
    this.readyState = this.OPEN;
    // @todo Only trigger open, when it's the first open event
    if(!this.initialConnectionDone) {
      this.initialConnectionDone = true;
      this.triggerEvent('open');
    }
  }.bind(this);

  xhr.ondone = function(strDataArray) {
    console.log('ON DONE IN POLL');
    this.readyState = this.CONNECTING; // Start reconnecting

    if(strDataArray === 'poll-start') {
      // This is a reconnect message

    } else {
      // console.log('TRIGGER MESSAGE');
console.log(strDataArray);
      var arrData = JSON.parse(strDataArray);
console.log(arrData);
      for(var i in arrData) {
console.log('TRIGGERING ON MESSAGE WITH:');
console.log(arrData[i]);
        this.triggerEvent('message', { type: 'message', data: arrData[i] });
      }
    }

    this.openPoll();
  }.bind(this);

  xhr.onclose = function() {
    console.log('ON CLOSE IN POLL (don\'t announce, if we try to reconnect)');
    // this.readyState = this.CLOSED;
    this.readyState = this.CONNECTING;
    this.openPoll();
    // this.triggerEvent('close', arguments);
  }.bind(this);

  this.connection = xhr.post(url);
};

SockItPoll.prototype.send = function(msg) {
  this.readyState = this.CONNECTING;

  var url = this.url + 'poll-msg';
  var xhr = new SockItXHR();

  xhr.post(url, msg);
};

// SockItPoll.prototype.sendBlob = function() { };
// SockItPoll.prototype.sendArrayBuffer = function() { };
// SockItPoll.prototype.sendArrayBufferView = function() { };
