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

// Going to use this as the event handler - don't want to deal with all kinds
// of event handling mechanisms used in different browsers
SockItXHR.prototype._readystatechange = function() {
  if(this.httpRequest.readyState === this.OPENED) {
    // Actually connecting as the send hasn't been called yet
    this.triggerEvent('open');

    if(this.isPolling) {
      this.httpRequest.killTimer = setTimeout(function() {
        this.httpRequest.abort();
      }.bind(this), (this.pollingTTL * 1000));
    }

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
      this.triggerEvent('error', err, this);
      this.triggerEvent('close');
    }
  }

  this.triggerEvent('readystatechange', arguments);
};

SockItXHR.prototype.post = function(url, post) {
  this.url = url;
  this.post = post; // @todo this is for debug!
  this.httpRequest.open('POST', url, true);
  this.httpRequest.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
  this.httpRequest.send(post);
};

SockItXHR.prototype.get = function(url) {
  this.url = url;
  this.httpRequest.open('GET', url, true);
  this.httpRequest.send();
};
