var cluster = require('cluster');
var numCPUs = require('os').cpus().length;

var bodyParser = require('body-parser');

var app = require('express')();
var server = require('http').Server(app);
var sockit = require('../lib/server.js')(server);

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

if(cluster.isMaster) {
  // Fork workers.
  for(var i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', function(worker, code, signal) {
    console.log('worker ' + worker.process.pid + ' died');
    console.log('starting new');
    cluster.fork();
  });

} else {

  server.listen(8080);

  sockit.on('connection', function(conn) {
    console.log('Sock.It opened a connection (pid: '+process.pid+'):');
  });

  sockit.on('message', function() {
    console.log('Got the following message (pid: '+process.pid+'):');
    console.log(arguments);
  });

  sockit.on('close', function() {
    console.log('Sock.it closed (pid: '+process.pid+'):');
    console.log(arguments);
  });


  sockit.on('error', function() {
    console.log('Got the following error (pid: '+process.pid+'):');
    console.log(arguments);
  });

}

