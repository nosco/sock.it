(function() {

(function() {
  /**
   * This is the common logic for both the Node.js and web browser
   * implementations of `debug()`.
   *
   * Expose `debug()` as the module.
   */

  exports = window.debug = debug;
  exports.coerce = coerce;
  exports.disable = disable;
  exports.enable = enable;
  exports.enabled = enabled;
  exports.humanize = ms;

  /**
   * The currently active debug mode names, and names to skip.
   */

  exports.names = [];
  exports.skips = [];

  /**
   * Map of special "%n" handling functions, for the debug "format" argument.
   *
   * Valid key names are a single, lowercased letter, i.e. "n".
   */

  exports.formatters = {};

  /**
   * Previously assigned color.
   */

  var prevColor = 0;

  /**
   * Previous log timestamp.
   */

  var prevTime;

  /**
   * Select a color.
   *
   * @return {Number}
   * @api private
   */

  function selectColor() {
    return exports.colors[prevColor++ % exports.colors.length];
  }

  /**
   * Create a debugger with the given `namespace`.
   *
   * @param {String} namespace
   * @return {Function}
   * @api public
   */

  function debug(namespace) {

    // define the `disabled` version
    function disabled() {
    }
    disabled.enabled = false;

    // define the `enabled` version
    function enabled() {

      var self = enabled;

      // set `diff` timestamp
      var curr = +new Date();
      var ms = curr - (prevTime || curr);
      self.diff = ms;
      self.prev = prevTime;
      self.curr = curr;
      prevTime = curr;

      // add the `color` if not set
      if (null == self.useColors) self.useColors = exports.useColors();
      if (null == self.color && self.useColors) self.color = selectColor();

      var args = Array.prototype.slice.call(arguments);

      args[0] = exports.coerce(args[0]);

      if ('string' !== typeof args[0]) {
        // anything else let's inspect with %o
        args = ['%o'].concat(args);
      }

      // apply any `formatters` transformations
      var index = 0;
      args[0] = args[0].replace(/%([a-z%])/g, function(match, format) {
        // if we encounter an escaped % then don't increase the array index
        if (match === '%%') return match;
        index++;
        var formatter = exports.formatters[format];
        if ('function' === typeof formatter) {
          var val = args[index];
          match = formatter.call(self, val);

          // now we need to remove `args[index]` since it's inlined in the `format`
          args.splice(index, 1);
          index--;
        }
        return match;
      });

      if ('function' === typeof exports.formatArgs) {
        args = exports.formatArgs.apply(self, args);
      }
      var logFn = enabled.log || exports.log || console.log.bind(console);
      logFn.apply(self, args);
    }
    enabled.enabled = true;

    var fn = exports.enabled(namespace) ? enabled : disabled;

    fn.namespace = namespace;

    return fn;
  }

  /**
   * Enables a debug mode by namespaces. This can include modes
   * separated by a colon and wildcards.
   *
   * @param {String} namespaces
   * @api public
   */

  function enable(namespaces) {
    exports.save(namespaces);

    var split = (namespaces || '').split(/[\s,]+/);
    var len = split.length;

    for (var i = 0; i < len; i++) {
      if (!split[i]) continue; // ignore empty strings
      namespaces = split[i].replace(/\*/g, '.*?');
      if (namespaces[0] === '-') {
        exports.skips.push(new RegExp('^' + namespaces.substr(1) + '$'));
      } else {
        exports.names.push(new RegExp('^' + namespaces + '$'));
      }
    }
  }

  /**
   * Disable debug output.
   *
   * @api public
   */

  function disable() {
    exports.enable('');
  }

  /**
   * Returns true if the given mode name is enabled, false otherwise.
   *
   * @param {String} name
   * @return {Boolean}
   * @api public
   */

  function enabled(name) {
    var i, len;
    for (i = 0, len = exports.skips.length; i < len; i++) {
      if (exports.skips[i].test(name)) {
        return false;
      }
    }
    for (i = 0, len = exports.names.length; i < len; i++) {
      if (exports.names[i].test(name)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Coerce `val`.
   *
   * @param {Mixed} val
   * @return {Mixed}
   * @api private
   */

  function coerce(val) {
    if (val instanceof Error) return val.stack || val.message;
    return val;
  }

  /**
   * Helpers.
   */

  var s = 1000;
  var m = s * 60;
  var h = m * 60;
  var d = h * 24;
  var y = d * 365.25;

  /**
   * Parse or format the given `val`.
   *
   * Options:
   *
   *  - `long` verbose formatting [false]
   *
   * @param {String|Number} val
   * @param {Object} options
   * @return {String|Number}
   * @api public
   */

  function ms(val, options){
    options = options || {};
    if ('string' == typeof val) return parse(val);
    return options.long
      ? long(val)
      : short(val);
  };

  /**
   * Parse the given `str` and return milliseconds.
   *
   * @param {String} str
   * @return {Number}
   * @api private
   */

  function parse(str) {
    var match = /^((?:\d+)?\.?\d+) *(ms|seconds?|s|minutes?|m|hours?|h|days?|d|years?|y)?$/i.exec(str);
    if (!match) return;
    var n = parseFloat(match[1]);
    var type = (match[2] || 'ms').toLowerCase();
    switch (type) {
      case 'years':
      case 'year':
      case 'y':
        return n * y;
      case 'days':
      case 'day':
      case 'd':
        return n * d;
      case 'hours':
      case 'hour':
      case 'h':
        return n * h;
      case 'minutes':
      case 'minute':
      case 'm':
        return n * m;
      case 'seconds':
      case 'second':
      case 's':
        return n * s;
      case 'ms':
        return n;
    }
  }

  /**
   * Short format for `ms`.
   *
   * @param {Number} ms
   * @return {String}
   * @api private
   */

  function short(ms) {
    if (ms >= d) return Math.round(ms / d) + 'd';
    if (ms >= h) return Math.round(ms / h) + 'h';
    if (ms >= m) return Math.round(ms / m) + 'm';
    if (ms >= s) return Math.round(ms / s) + 's';
    return ms + 'ms';
  }

  /**
   * Long format for `ms`.
   *
   * @param {Number} ms
   * @return {String}
   * @api private
   */

  function long(ms) {
    return plural(ms, d, 'day')
      || plural(ms, h, 'hour')
      || plural(ms, m, 'minute')
      || plural(ms, s, 'second')
      || ms + ' ms';
  }

  /**
   * Pluralization helper.
   */

  function plural(ms, n, name) {
    if (ms < n) return;
    if (ms < n * 1.5) return Math.floor(ms / n) + ' ' + name;
    return Math.ceil(ms / n) + ' ' + name + 's';
  }

  /**
   * This is the web browser implementation of `debug()`.
   *
   * Expose `debug()` as the module.
   */

  exports.log = log;
  exports.formatArgs = formatArgs;
  exports.save = save;
  exports.load = load;
  exports.useColors = useColors;

  /**
   * Colors.
   */

  exports.colors = [
    'lightseagreen',
    'forestgreen',
    'goldenrod',
    'dodgerblue',
    'darkorchid',
    'crimson'
  ];

  /**
   * Currently only WebKit-based Web Inspectors, Firefox >= v31,
   * and the Firebug extension (any Firefox version) are known
   * to support "%c" CSS customizations.
   *
   * TODO: add a `localStorage` variable to explicitly enable/disable colors
   */

  function useColors() {
    // is webkit? http://stackoverflow.com/a/16459606/376773
    return ('WebkitAppearance' in document.documentElement.style) ||
      // is firebug? http://stackoverflow.com/a/398120/376773
      (window.console && (console.firebug || (console.exception && console.table))) ||
      // is firefox >= v31?
      // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
      (navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31);
  }

  /**
   * Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
   */

  exports.formatters.j = function(v) {
    return JSON.stringify(v);
  };


  /**
   * Colorize log arguments if enabled.
   *
   * @api public
   */

  function formatArgs() {
    var args = arguments;
    var useColors = this.useColors;

    args[0] = (useColors ? '%c' : '')
      + this.namespace
      + (useColors ? ' %c' : ' ')
      + args[0]
      + (useColors ? '%c ' : ' ')
      + '+' + exports.humanize(this.diff);

    if (!useColors) return args;

    var c = 'color: ' + this.color;
    args = [args[0], c, 'color: inherit'].concat(Array.prototype.slice.call(args, 1));

    // the final "%c" is somewhat tricky, because there could be other
    // arguments passed either before or after the %c, so we need to
    // figure out the correct index to insert the CSS into
    var index = 0;
    var lastC = 0;
    args[0].replace(/%[a-z%]/g, function(match) {
      if ('%%' === match) return;
      index++;
      if ('%c' === match) {
        // we only are interested in the *last* %c
        // (the user may have provided their own)
        lastC = index;
      }
    });

    args.splice(lastC, 0, c);
    return args;
  }

  /**
   * Invokes `console.log()` when available.
   * No-op when `console.log` is not a "function".
   *
   * @api public
   */

  function log() {
    // This hackery is required for IE8,
    // where the `console.log` function doesn't have 'apply'
    return 'object' == typeof console
      && 'function' == typeof console.log
      && Function.prototype.apply.call(console.log, console, arguments);
  }

  /**
   * Save `namespaces`.
   *
   * @param {String} namespaces
   * @api private
   */

  function save(namespaces) {
    try {
      if (null == namespaces) {
        localStorage.removeItem('debug');
      } else {
        localStorage.debug = namespaces;
      }
    } catch(e) {}
  }

  /**
   * Load `namespaces`.
   *
   * @return {String} returns the previously persisted debug modes
   * @api private
   */

  function load() {
    var r;
    try {
      r = localStorage.debug;
    } catch(e) {}
    return r;
  }

  /**
   * Enable namespaces listed in `localStorage.debug` initially.
   */

  exports.enable(load());

})();

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
var SockItXHR = function(isPolling) {
  if(!(this instanceof SockItXHR)) return new SockItXHR();

  this.isPolling                      = isPolling || false;

  this.httpRequest                    = this.getHttpRequestObject();
  this.httpRequest.onreadystatechange = this._readystatechange.bind(this);

  this.readyState                     = this.httpRequest.readyState;

  this.pollingTTL                     = 25; // Most problems should start at 30 sec earliest

  this.UNSENT                         = 0;  // open() has not been called yet.
  this.OPENED                         = 1;  // send() has not been called yet.
  this.HEADERS_RECEIVED               = 2;  // send() has been called, and headers and status are available.
  this.LOADING                        = 3;  // Downloading; responseText holds partial data.
  this.DONE                           = 4;  // The operation is complete.
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
SockItXHR.prototype.ontimeout          = null;
SockItXHR.prototype.onaborted          = null;

SockItXHR.prototype.stopKillTimer = function() {
  if(this.killTimer) {
    clearTimeout(this.killTimer);
    this.killTimer = null;
  }
};

SockItXHR.prototype.startKillTimer = function() {
  this.stopKillTimer();

  // this.httpRequest.timeout = (this.pollingTTL * 1000);

  this.killTimer = setTimeout(function() {
    if(this.httpRequest.readyState <= this.OPENED) {
      this.httpRequest.abort();
      this.triggerEvent('aborted');

    } else {
      this.startKillTimer();
    }
  }.bind(this), (this.pollingTTL * 1000));
};


// Going to use this as the event handler - don't want to deal with all kinds
// of event handling mechanisms used in different browsers
SockItXHR.prototype._readystatechange = function() {
  this.readyState = this.httpRequest.readyState;

  if(this.httpRequest.readyState === this.OPENED) {
    // Actually connecting as the send hasn't been called yet
    this.triggerEvent('open');

    if(this.isPolling) {
      this.startKillTimer();
    }

  } else if(this.httpRequest.readyState === this.HEADERS_RECEIVED) {
    this.stopKillTimer();
    // The poll stops already at opened
  } else if(this.httpRequest.readyState === this.LOADING) {
    this.stopKillTimer();
    // The poll stops already at opened
  } else if(this.httpRequest.readyState === this.DONE) {
    this.stopKillTimer();

    if(this.httpRequest.status === 200) {
      this.triggerEvent('message', this.httpRequest.responseText);
      this.triggerEvent('done', this.httpRequest.responseText);
      this.triggerEvent('close');

    } else {
      // This is probably a crash
      var err = new Error('Connection failed with HTTP code: '+this.httpRequest.status);
      this.triggerEvent('error', err, this);
      this.triggerEvent('close');
    }
  }

  this.triggerEvent('readystatechange', arguments);
};

SockItXHR.prototype.post = function(url, post) {
  this.method = 'POST';
  this.url = url;
  this.post = post;
  this.httpRequest.open('POST', url, true);
  this.httpRequest.onerror = function() {
    console.log('got a post error!!!');
    console.log(arguments);
  };
  this.httpRequest.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
  this.httpRequest.setRequestHeader('X-API-URL', url);
  this.httpRequest.send(post);
};

SockItXHR.prototype.get = function(url) {
  this.method = 'GET';
  this.url = url;
  this.httpRequest.setRequestHeader('X-API-URL', url);
  this.httpRequest.open('GET', url, true);
  this.httpRequest.onerror = function() {
    console.log('got a get error!!!');
    console.log(arguments);
  };
  this.httpRequest.send();
};
var SockItPoll = function(url) {
  if(!(this instanceof SockItPoll)) return new SockItPoll();

  this.initialConnectionDone = false;
  this.retryTimeout          = 0;
  this.retryTimer            = null;

  this.CONNECTING            = 0;           // const readyState state
  this.OPEN                  = 1;           // const readyState state
  this.CLOSING               = 2;           // const readyState state
  this.CLOSED                = 3;           // const readyState state
  this.readyState            = this.CLOSED; // readonly

  this.url                   = url.replace(/^ws/i, 'http');

  this.startPoll();

  this.pollXHR               = null;

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
    this.readyState = this.CLOSED; // Start reconnecting

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
  if(this.readyState !== this.CLOSED) {
    return false;
  }

  this.readyState = this.CONNECTING;

  if(!this.retryTimeout) return this._openPoll();

  if(this.retryTimer !== null) {
    clearTimeout(this.retryTimer);
  }

  this.retryTimer = setTimeout(function() {
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
  this.pollXHR = new SockItXHR(true);

  this.pollXHR.onopen = function() {
    sockit.debug.xhr('Event: open');

    this.readyState = this.OPEN;
    // @todo Only trigger open, when it's the first open event
    if(!this.initialConnectionDone) {
      this.initialConnectionDone = true;
    }

    this.triggerEvent('open');
  }.bind(this);

  this.pollXHR.ondone = function(strDataArray) {
    sockit.debug.xhr('Event: done');

    this.retryTimeout = 0;

    this.readyState = this.CLOSING; // Start reconnecting

    if(strDataArray === 'poll-start') {
      // This is a reconnect message - it should retry automatically

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

  this.pollXHR.onaborted = function() {
    this.readyState = this.CLOSING; // Start reconnecting

    this.retryTimeout = 0;
  }.bind(this);

  this.pollXHR.onerror = function() {
    this.readyState = this.CLOSED; // Start reconnecting

    if(!this.retryTimeout) this.retryTimeout = 100;

    this.retryTimeout = Math.ceil(this.retryTimeout * 1.5);
    // Making sure, we don't start waiting forever
    if(this.retryTimeout > 10000) this.retryTimeout = 10000;
  }.bind(this);

  this.pollXHR.onclose = function() {
    sockit.debug.xhr('Event: close');
    this.readyState = this.CLOSED; // Start reconnecting
    this.openPoll();
  }.bind(this);

  this.connection = this.pollXHR.post(url);
};

SockItPoll.prototype.send = function(msg) {
  this.messageQueue.push(msg);

  // Pile up messages
  setTimeout(this.sendMessages.bind(this), 0);
};


SockItPoll.prototype.sendMessages = function() {
  if(this.messageQueue.length) {

    var messages = this.messageQueue.splice(0, this.messageQueue.length);
    var url = this.url + 'poll-msg';
    var xhr = new SockItXHR();
    xhr.onaborted = function() {
      this.reSendMessages(messages);
    }.bind(this);
    xhr.onerror = function() {
      this.reSendMessages(messages);
    }.bind(this);

    xhr.ondone = function(strDataArray) {
      if(strDataArray === 'poll-start') {
        // This is a reconnect message - put the messages back into the queue
        this.reSendMessages(messages);
      }
    }.bind(this);

    sockit.debug.client('Sending message');
    sockit.debug.client(messages);

    xhr.post(url, JSON.stringify(messages));
  }
};

SockItPoll.prototype.reSendMessages = function(messages) {
  for(var i=messages.length ; i > 0 ; i--) {
    this.messageQueue.unshift(messages[(i-1)]);
  }
  this.pollXHR.httpRequest.abort();
  this.sendMessages();
};


// SockItPoll.prototype.sendBlob = function() { };
// SockItPoll.prototype.sendArrayBuffer = function() { };
// SockItPoll.prototype.sendArrayBufferView = function() { };
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
  this.debug.msgIn = debug('sockit:msg-in');
  this.debug.msgIn.color = debug.colors[4];
  this.debug.msgOut = debug('sockit:msg-out');
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
  if(!msg) console.log('GOT A BROKEN MESSAGE FROM .send');
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

window.SockIt = SockIt;
})();

