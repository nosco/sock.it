var app = require('express')();
var server = require('http').Server(app);
var sockit = require('./lib/server.js')(server);
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');

app.enable('trust proxy');
app.disable('x-powered-by');
app.disable('etag');

app.use( cookieParser() );
app.use( bodyParser.urlencoded( { extended: false }) );

// app.use('/sock.it', function(req, res, next) {
//   console.log('This is polling');
//   // Keep the connection, but wait for content for it
//   // console.log(require('util').inspect(req, {depth:20}));
//   // console.log(req.query);
//   // console.log(req.body);
//   // console.log(req.headers);
//   res.jsonp([{ back: 'atcha' }, { and: 'atcha' }]);
// });//express.static(__dirname + '/public'));

app.get(['/', '/index'], function(req, res, next) {
  console.log('IN THIS');

  res.set({'Content-Type': 'text/html'});
  res.cookie('testCookie4', 'someValue', { path: '/', secure: true, httpOnly: true });
  res.sendFile('index.html', {root: __dirname});
  // next();
});//express.static(__dirname + '/public'));

server.listen(8080);
