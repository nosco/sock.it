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
};