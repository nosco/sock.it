var app = require('express')();
var server = require('http').Server(app);
var sockit = require('../lib/server.js')(server);
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');

app.enable('trust proxy');
app.disable('x-powered-by');
app.disable('etag');

app.use( cookieParser() );
app.use( bodyParser.urlencoded( { extended: false }) );

app.get(['/', '/index'], function(req, res, next) {
  res.set({'Content-Type': 'text/html'});
  res.cookie('testCookie4', 'someValue', { path: '/', secure: true, httpOnly: true });
  res.sendFile('index.html', {root: __dirname});
});

server.listen(8080);
