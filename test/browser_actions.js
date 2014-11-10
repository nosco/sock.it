var webdriver = require('selenium-webdriver');
var fs = require('fs');

/**
 * A class with common actions we use for Selenium based browser testing
 * @todo  could probably be made better by prototyping on the Selenium driver
 */
var BrowserActions = function() {};
module.exports = BrowserActions;

BrowserActions.prototype.startServer = function(serverName) {
  var defered = webdriver.promise.defer();

  serverName = serverName.toLowerCase();
  this.serverName = serverName;

  switch(serverName) {
    case "chrome":
      this.server = require('chromedriver');
      this.driver = new webdriver.Builder().usingServer('http://127.0.0.1:9515/').
      withCapabilities(webdriver.Capabilities.chrome()).build();
      break;
    case "phantom":
    case "phantomjs":
      this.server = require('phantomjs-server');
      this.driver = new webdriver.Builder().usingServer(this.server.address()).
      withCapabilities({ "browserName": "phantomjs" }).build()
      // this.driver2 = new webdriver.Builder().usingServer(this.server.address()).
      // withCapabilities({ "browserName": "phantomjs" }).build()
      break;
  }

  this.server.start();

  this.driver.manage().window().setSize(1024, 768).then(function() {
    defered.fulfill();
  });
  // this.driver2.manage().window().setSize(1400, 800);


  return defered.promise;
};

BrowserActions.prototype.stopServer = function() {
  var defered = webdriver.promise.defer();

  switch(this.serverName) {
    case "chrome":
      this.server.stop();
      defered.fulfill();
      break;
    case "phantom":
    case "phantomjs":
      this.driver.quit().then(function() {
        this.server.stop();
        defered.fulfill();
      }.bind(this));
      break;
  }

  return defered.promise;
};

BrowserActions.prototype.takeScreenshot = function(savePath, driver) {
  var defered = webdriver.promise.defer();

  savePath = savePath || '/tmp/screenshot.png';
  driver = driver || this.driver;

  driver.takeScreenshot().then(function(data) {
    fs.writeFile(savePath, new Buffer(data, 'base64'), function(err) {
      if(err) defered.reject(err);
      else defered.fulfill();
    });
  });
}

