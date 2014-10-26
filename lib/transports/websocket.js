var WSServer = require('ws').Server;

var WebSocketClient = require('./websocket-client');

var WebSocketTransport = function(httpServer, config) {
  this.clients = [];
  this.clientsReversed = {};

  this.httpServer = httpServer;
  this.config = config;
  this.attach();
};
exports.Server = WebSocketTransport;

WebSocketTransport.prototype.attach = function() {

  this.wsServer = new WSServer({ server: this.httpServer });
  this.wsServer.on('connection', function(ws) {
    // var client = new WebSocketClient({
    //   ws: ws
    // });

    // var index = this.clients.push(client);
    // this.clientsReversed[cookies[this.config.cookieName].value] = (index-1);
  });

  // this.requestListeners = this.httpServer.listeners('request').slice(0);
  // this.httpServer.removeAllListeners('request');
  // this.httpServer.on('request', this.onRequest.bind(this));
};


        // // Place somewhere else!!!
        // this.webSocketServer.broadcast = function(data) {
        //   for(var i in this.clients)
        //       this.clients[i].send(data);
        // };

        // this.webSocketServer.on('error', function() {
        //   console.log('wss error');
        //   console.log(arguments);
        // });

        // this.webSocketServer.on('close', function() {
        //   console.log('wss close');
        //   console.log(arguments);
        // });


        // this.webSocketServer.on('connection', function(ws) {
        //   if(ws.upgradeReq && ws.upgradeReq.url) {
        //     console.log('ws.upgradeReq.url');
        //     console.log(ws.upgradeReq.url);
        //     console.time('ws connection time');
        //   }

        //   console.log('websocket connected');

        //   ws.on('error', function() {
        //     console.log('ws error');
        //     console.log(arguments);
        //   });

        //   ws.on('message', function(msg) {
        //     console.log('ws message');
        //     console.log(msg);
        //     this.webSocketServer.broadcast(msg);
        //   });

        //   // var id = setInterval(function() {
        //   //   ws.send(JSON.stringify(process.memoryUsage()), function() { /* ignore errors */ });
        //   // }, 100);
        //   // console.log('started client interval');

        //   ws.on('close', function() {
        //     console.log('ws close');
        //     console.timeEnd('ws connection time');
        //   });
        // }.bind(this));
