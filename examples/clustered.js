console.log('This is not a runable example yet!');
console.log('Please read the source :)');
process.exit();

// In order for this library to work with redis, we need to have a WORKER id
// on all processes.
// When a process dies any new process should inherit the WORKER id
//
// This is the default cluster example from node.js
// With added example for added a env.WORKER variable to the childs process variable
var cluster = require('cluster');
var http = require('http');
var numCPUs = require('os').cpus().length;

if(cluster.isMaster) {
  // Fork workers.
  for(var i = 0; i < numCPUs; i++) {
    cluster.fork({WORKER: 1+i});
  }

  cluster.on('exit', function(worker, code, signal) {
    console.log('worker ' + worker.process.pid + ' died');
  });

} else {
  console.log(process);
  // Workers can share any TCP connection
  // In this case its a HTTP server
  http.createServer(function(req, res) {
    res.writeHead(200);
    res.end("hello world\n");
  }).listen(8000);
}
