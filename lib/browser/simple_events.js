// SimpleEvents is... Well... Simple events to be inherited from
var SimpleEvents = function() {};

SimpleEvents.prototype.events = function(eventObjects) {
  for(var i in eventObjects) {
    this.on(i, eventObjects[i]);
  }
};

SimpleEvents.prototype.on = function(type, listener, context) {
  if(!this._simple_events) {
    this._simple_events = {};
  }
  if(!this._simple_events[type]) {
    this._simple_events[type] = [];
  }
  if($.inArray(listener, this._simple_events[type]) !== -1) {
    return false;
  }
  this._simple_events[type].push(listener);
  return listener;
};
SimpleEvents.prototype.listenTo = function(other, event, listener) {
  other.on(event, listener.bind(this));
};

SimpleEvents.prototype.once = function(type, listener, context) {
  if(!this._simple_events_once) {
    this._simple_events_once = {};
  }
  if(!this._simple_events_once[type]) {
    this._simple_events_once[type] = [];
  }
  if($.inArray(listener, this._simple_events_once[type]) !== -1) {
    return false;
  }
  this._simple_events_once[type].push(listener);
  return listener;
};
SimpleEvents.prototype.listenToOnce = function(other, event, listener) {
  other.once(event, listener.bind(this));
};

// This is a special "on" listener that will also call the listener
// immediately, if the object being listened to has this.ready set to true
SimpleEvents.prototype.onReady = function(type, listener, context) {
  this.on.apply(this, arguments);

  if(this.ready) {
    var eventData = null;
    if(typeof this.readyTriggerData === 'function') {
      eventData = this.readyTriggerData();
    }
    listener(eventData);
  }

  return listener;
};

// This is a special "once" listener that will also call the listener
// immediately, if the object being listened to has this.ready set to true
SimpleEvents.prototype.onceReady = function(type, listener, context) {
  this.once.apply(this, arguments);

  if(this.ready) {
    var eventData = null;
    if(typeof this.readyTriggerData === 'function') {
      eventData = this.readyTriggerData();
    }
    listener(eventData);
  }

  return listener;
};

SimpleEvents.prototype.off = function(type, listener, context) {
  if(this._simple_events && this._simple_events[type]) {
    var index = $.inArray(listener, this._simple_events[type]);
    if(index > -1) {
      this._simple_events[type].splice(index, 1);
    }
  }

  if(this._simple_events_once && this._simple_events_once[type]) {
    var index = $.inArray(listener, this._simple_events_once[type]);
    if(index > -1) {
      this._simple_events_once[type].splice(index, 1);
    }
  }

  return true;
};
SimpleEvents.prototype.stopListening = function(other, event, listener) {
  other.off(event, listener, this);
};


SimpleEvents.prototype.trigger = function(type, eventData) {
  if(this._simple_events && this._simple_events[type]) {
    for(var i in this._simple_events[type]) {

      if(typeof this._simple_events[type][i] === 'string') {
        this[ this._simple_events[type][i] ](eventData);

      } else if(typeof this._simple_events[type][i] === 'function') {
        this._simple_events[type][i](eventData);
      }

    }
  }

  if(this._simple_events_once && this._simple_events_once[type]) {
    for(var n in this._simple_events_once[type]) {

      if(typeof this._simple_events_once[type][n] === 'string') {
        this[ this._simple_events_once[type][n] ](eventData);

      } else if(typeof this._simple_events_once[type][n] === 'function') {
        this._simple_events_once[type][n](eventData);
      }

    }
    this._simple_events_once[type] = [];
  }
  return true;
};
SimpleEvents.prototype.emit = SimpleEvents.prototype.trigger;
