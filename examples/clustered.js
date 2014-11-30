var cluster = require('cluster');
var numCPUs = require('os').cpus().length;

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

  server.listen(8080);

  sockit.on('connection', function(conn) {
    debug.srv('Got a connection on process pid '+process.pid+'!');

    conn.on('message', function() {
      debug.srv('Received message on process pid: '+process.pid+':');
      debug.srv(arguments);

      debug.srv('Replying in 1s');
      setTimeout(function() {
        debug.srv('Sending a reply on process pid: '+process.pid);
        debug.srv('a test message to the browser');
        conn.send('a test message to the browser');
      }, 1000);

    });
  });

}


