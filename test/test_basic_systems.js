/*
 * Currently everything is working, but it would probably be nice to have a way
 * of putting all the initialization stuff into a seperat file.
 * That way, the tests will be much more in focus.
 */
var assert = require('chai').assert;
var app = require('express')();
var server = require('http').Server(app);
var bodyParser = require('body-parser');

var sockit = require('../lib/server.js')(server);
var BrowserActions = require('./browser_actions');


describe('Testing basic functionality', function() {
  var browser;
  var conn = null;

  before(function(done) {
    browser = new BrowserActions();
    browser.startServer('chrome').then(done.bind(this, null), done);
    // browser.startServer('phantom').then(done.bind(this, null), done);
  });

  after(function(done) {
    browser.stopServer().then(done.bind(this, null), done);
  });

  describe('Start up the server', function() {
    app.use( bodyParser.urlencoded( { extended: false }) );

    app.get(['/', '/index'], function(req, res, next) {
      res.set({'Content-Type': 'text/html'});
      res.sendFile('/test/basic_systems.html', {root: __dirname + '/../'});
    });

    app.get('/sock.it/client', function(req, res, next) {
      res.set({'Content-Type': 'application/javascript'});
      res.sendFile('/browser/client.js', {root: __dirname + '/../'});
    });

    server.listen(1337);
  });

  describe('Test basic functionality', function() {
    it('Start listening for connections on the server', function(done) {
      sockit.on('connection', function(connection) {
        conn = connection;
      });
      done();
    });

    it('Go to the single threaded main page', function(done) {
      browser.driver.get('http://127.0.0.1:1337/').then(done.bind(this, null), done);
    });

    it('Check that a connection was received on the server', function(done) {
      if(conn) done();
      else done(new Error('No connection was establish'));
    });

    it('Check that a connection was received in the browser', function(done) {
      browser.driver.executeScript("return sockit.readyState;").then(function(readyState) {
        assert.equal(readyState, 1);
        done();
      });
    });

    it('Check message from browser to server', function(done) {
      var sendMessage = 'Yo man!';
      var receivedMessage = null;
      conn.on('message', function(msg) {
        receivedMessage = msg;
      });

      browser.driver.executeScript("return sockit.send('"+sendMessage+"');").then(function() {
        browser.driver.sleep(2000).then(function() {
          assert.equal(receivedMessage, sendMessage);
          done();
        });
      });
    });

    it('Check message from server to browser', function(done) {
      var sendMessage = "What's up?";
      conn.send(sendMessage);

      browser.driver.wait(function() {
        return browser.driver.executeScript('return (window.lastMessage.data === "'+sendMessage+'");');
      }, 4000, 'Never got correct lastMessage').then(done.bind(this, null), null);
    });
  });

});



// sockit.on('connection', function(conn) {
//   debug.srv('Got a connection!');

//   // conn.send('a test message to the browser');
//   setInterval(function() {
//     conn.send('a test message to the browser');
//   }, 2000);

//   conn.on('message', function() {
//     debug.conn('Got the following message:');
//     debug.conn(arguments);
//   });
// });

