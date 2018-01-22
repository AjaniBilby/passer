var Treasury = require('./component/session.js');
var path = require('./component/path.js');
var query = require('querystring');
var fs = require('fs');

//Internet modules
var https = require('https');
var http = require('http');

var mimeTypes = JSON.parse(fs.readFileSync(__dirname + '/mimeTypes.json'));

//NOTE: on session define, check if the session id has changed




class App{
  constructor(){
    this.port = [];

    this.binding = [];
    this.auth = [];

    this.publicFolder = null;
    this.hasSessions = true;
  }
}

/**
 * Make the app listen on a port for requests
 * @param {number} port 
 * @param {any} opts 
 */
App.prototype.listen = function(port, opts){
  let i = this.ports.length;
  let self = this;

  if (opts){
    this.port[i] = https.createServer(opts, ()=>{
      self.request.apply(self, arguments);
    })
  }else{
    this.port[i] = http.Server(()=>{
      self.request.apply(self, arguments);
    })
  }

  this.port[i].listen(port, ()=>{
    console.info('Listening on', port);
  });

  return this.port[i];
}