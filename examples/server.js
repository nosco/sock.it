var app = require('express')();
var server = require('http').Server(app);
var sockit = require('../lib/server.js')(server);
var bodyParser = require('body-parser');

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

sockit.onmessage = function() {
  console.log('Got the following message:');
  console.log(arguments);
}