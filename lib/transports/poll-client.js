// Just an example of how a poll server client could simulate a websocket server client
// var pollClient = {
//   _socket: {},
//   bytesReceived: 0,
//   readyState: 1,
//   supports: {},
//   protocol: undefined,
//   protocolVersion: 13,
//   upgradeReq: {},
//   _isServer: true,
//   _receiver: {},
//   _sender: {},
//   _events: {}
// };

var PollClient = function(info) {
  for(var i in info) this[i] = info[i];
};
module.exports = PollClient;

PollClient.prototype.send =
PollClient.prototype.sendMessage = function(msg) {
  // @todo check for closed, connection, etc.
  // set readyState to closing
  console.log('send a message');
  console.log(msg);

  // This should not be necessary after all - it is being set in the poll.js
  // Set this header!
//    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',

  this.response.end(msg);
};
