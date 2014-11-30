[![NPM version](https://badge.fury.io/js/sock.it.png)](http://badge.fury.io/js/sock.it)

# Sock It

### THIS IS A VERY EARLY DEVELOPMENT VERSION!!!
Don't use in a production environment, it is created and tested for a very specific set of problems!

Also be sure to read the [Known Bugs](known-bugs.md) document.

### What is it?
An attempt to create a WebSocket API compatible library, that has a thin wrapper
around WebSockets with a fat polling fallback for legacy browsers.

It is not meant to solve all problems related to WebSocket/polling, like be the
absolutely fastest solution or support ALL possible scenarios.

### What it IS meant to solve:
* Speed (e.g. as fast as possible, while still solving the other points)
* Tiny wrapper around WebSocket, working as directly as possible with native WebSocket
* Fallback to JSON poll, when WebSocket is not around
* Scalable backend code through Redis (both horizontally and vertically)
* Emphasis on leaving as much to WebSockets as possible, when available
* Compatibility with IE8+, Safari, Chrome, Firefox

### What it is NOT meant to solve:
* Speed (e.g. this is not going to be THE fastest WS/poll library around)
* Being able to work under ANY proxy/router configuration out there
* Working with > legacy browsers (Currently focus is on IE8+, but should be fine, down to IE6)
* Achieving WebSocket speeds when falling back to poll

### Future

As always: as soon as the module has shown it's worth and stability on a live system, it will be marked as version >= 1.0.0.

Until then: Feel free to play around with it, learn from it, help with it, etc.

### To install

	npm install sock.it
