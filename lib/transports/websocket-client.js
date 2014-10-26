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

var WebSocketClient = function(info) {
  for(var i in info) this[i] = info[i];
  this.initConnection();
};
module.exports = WebSocketClient;

WebSocketClient.prototype.initConnection = function() {
  // var id = setInterval(function() {
  //   ws.send(JSON.stringify(process.memoryUsage()), function() { /* ignore errors */ });
  // }, 100);
  // console.log('started client interval');
  // this.send('testing');
  this.ws.on('close', function() {
    console.log('stopping client interval');
    // clearInterval(id);
  });

  this.ws.on('message', function() {
    console.log('got a message');
    console.log(arguments);
    // clearInterval(id);
  });
};


WebSocketClient.prototype.send =
WebSocketClient.prototype.sendMessage = function(msg) {
  this.ws.send(msg, function() {
    console.log(arguments);
    console.log('what to do with errors?');
    /* ignore errors */
  });

  // // @todo check for closed, connection, etc.
  // // set readyState to closing
  // console.log('send a message');
  // this.response.end(JSON.stringify({ msg: msg }));
};
