var app = require('express')();
var server = require('http').Server(app);
var sockit = require('../lib/server.js')(server);
var bodyParser = require('body-parser');

server.on('connection', function() {
  server.getConnections(function(err, count) {
    if(err) {
      debug.sys('getConnections experienced an error');
    } else {
      debug.sys('Current active connections: '+count);
    }
  });
});

app.enable('trust proxy');
app.disable('x-powered-by');
app.disable('etag');

app.use( bodyParser.urlencoded( { extended: false }) );

app.get(['/', '/index'], function(req, res, next) {
  res.set({'Content-Type': 'text/html'});
  res.sendFile('index.html', {root: __dirname});
});

app.get('/sock.it/client', function(req, res, next) {
  res.set({'Content-Type': 'application/javascript'});
  res.sendFile('/browser/client.js', {root: __dirname});
});

server.listen(8080);

sockit.on('connection', function(conn) {
  debug.srv('Got a connection!');

  // conn.send('a test message to the browser');
  setInterval(function() {
    conn.send('a test message to the browser');
  }, 2000);

  conn.on('message', function() {
    debug.srv('Got the following message:');
    debug.srv(arguments);
  });
});

