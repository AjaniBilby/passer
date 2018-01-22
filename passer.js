var Treasury = require('./component/session.js');
var form = require('./component/form.js');
var path = require('./component/path.js');
var query = require('querystring');
var fs = require('fs');

//Internet modules
var https = require('https');
var http = require('http');

var mimeTypes = JSON.parse(fs.readFileSync(__dirname + '/mimeTypes.json'));




class Binding{
  /**
   * 
   * @param {string} method 
   * @param {string} path 
   * @param {function} callback 
   * @param {any} requirements 
   */
  constructor(method, path, callback, requirements){
    this.method = method;
    this.path = path;
    this.handle = callback;
    this.form = requirements.form;
  }

  match(url){
    return path.match(this.path, url);
  }
}




class Authenticator{
  /**
   * 
   * @param {string[]} paths 
   * @param {function} validityTestor 
   * @param {function} denied 
   * @param {string[]} ignore 
   */
  constructor(paths, validityTestor, denied, ignore){
    this.paths = paths;
    this.ignore = ignore;
    this.test = validityTestor;
    this.deny = denied;
  }

  match(url){
    for (let ignore of this.ignore){
      if (path.match(ignore, url)){
        return true;
      }
    }

    for (let path of this.paths){
      if (path.match(path, url)){
        return this.test();
      }
    }

    return true;
  }
}




class App{
  constructor(){
    this.treasury = new Treasury();
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
/**
 * App's request handler
 * @param {any} req 
 * @param {any} res 
 */
App.prototype.request = async function(req, res){
  /*-----------------------------------------
      Get Cookies
  -----------------------------------------*/
  req.cookies = {};
  if (req.headers && req.headers.cookie){
    parts = req.headers.cookie.split(';');
    for (let item of parts){
      var sections = item.split('=');
      if (sections.length < 1){
        continue;
      }
      name = sections[0];
      while (name[0] == " "){
        name = name.slice(1);
      }
      sections = sections.splice(1);
      if (sections.length < 1){
        sections = [true];
      }
      req.cookies[name] = sections.join('=');
    }
  }





  /*-----------------------------------------
      Get Query
  -----------------------------------------*/
  let queryIndex = req.url.indexOf('?');
  if (index === -1){
    req.queryString = '';
  }else{
    req.queryString = req.url.substr(queryIndex+1);
  }

  req.query = query.parse(req.queryString);





  /*-----------------------------------------
      Get Raw Path
  -----------------------------------------*/
  if (queryIndex != -1){
    req.path = req.url.slice(0, queryIndex);
  }else{
    req.path = decodeURIComponent(req.url);
  }
  




  /*-----------------------------------------
      Get Extention
  -----------------------------------------*/
  req.extention = path.extension(req.path);
  let page = req.path == '/' ? '/index' : req.path;





  /*-----------------------------------------
      Get Session
  -----------------------------------------*/
  this.validate(req,res);





  /*-----------------------------------------
      Get Authorization
  -----------------------------------------*/
  if (!await this.IsAuthorized(req, res)){
    return false;
  }





  /*-----------------------------------------
      Run URL Handle
  -----------------------------------------*/
  let method = req.method.toLowerCase();
  req.form = null;
  for (let bind of this.binding){
    if (method != bind.method){
      continue;
    }

    req.wildcards = bind.match(req.path);
    if (req.wildcards){
      if (bind.form){
        req.form = await form.decode(req);
      }

      bind.handle(req, res);
      return true;
    }
  }





  /*-----------------------------------------
      Get File
  -----------------------------------------*/
  if (this.publicFolder){
    try{
      await this.parseFile(req, res, `${this.publicFolder}${page}.`+(req.extension || 'html'));
    }catch(e){
      if (e !== null){
        console.error(e);
      }
    }finally{
      return true;
    }
  }

  this.on404(req, res);
  return false;
}


/**
 * Check if a request meets all auth rules
 * @param {any} req 
 * @param {any} res 
 */
App.prototype.IsAuthorized = async function(req, res){
  let valid = false;

  for (let rule of this.auth){
    valid = await rule.match(req.path);
    if (!valid){
      await rule.deny(req, res);
      return false;
    }
  }

  return true;
}
/**
 * Give the request a valid session if it is appropriate
 * @param {any} req 
 * @param {any} res 
 */
App.prototype.validate = function(req, res){
  if (this.noSession){
    return true;
  }

  let ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress || req.connection.socket.remoteAddress;

  req.session = this.treasury.define(req.cookies.session || '', ip);

  //If the session was created make sure the client now has the new id
  if (req.cookies.session != req.session.id){
    res.setHeader('Set-Cookie', `session=${req.session.id};path=/`);
  }

  return true;
}


/**
 * Handler for 404 responses
 * @param {any} res 
 * @param {any} res 
 */
App.prototype.on404 = function(res, res){
  res.statusCode = 404;
  res.end('Cannot find ' + req.url);
}
/**
 * Parse a file to the requester
 * @param {any} req 
 * @param {any} res 
 * @param {string} file 
 */
App.prototype.parseFile = function(req, res, file){
  let mimeType = mimeTypes[req.extension];
  if (mimeType){
    res.setHeader('Content-Type', mimeType);
  }

  return new Promise((resolve, rejct)=>{
    fs.exists(file, function(exists){
      if (!exists){
        throw null;
        return null;
      }

      fs.stat(file, (err, stats)=>{
        if (err){
          throw err;
        }
        let opts = undefined;

        if (req.headers.range){  //Set headers for section of a stream
          let total = stats.size || 0;
          let range = req.headers.range;
          let parts = range.replace(/bytes=/g, "").split('-');

          let start = parseInt(parts[0], 10);
          let end = parts[1] ? parseInt(parts[1], 10) : total -1;
          let chunksize = (end - start) + 1;
          
          res.setHeader('Content-Range', `bytes ${start}-${end}/${totla}`);
          res.setHeader('Accept-Ranges', 'bytes');
          res.setHeader('Content-Length', chunksize);
          opts = {start, end};
          return
        }else{                   //Set headers for blob stream
          res.setHeader('Chunked', 'true');
          res.setHeader('Content-Length', stats.size || 0);
        }

        //Create stream
        let stream = fs.createReadStream(file, opts);
        stream.pipe(res);

        //Stop reading the file if the request is closed (saves read cycles)
        req.on('end', stream.close);
        req.on('close', stream.close);
        req.on('error', stream.close);
  
        resolve(true);
      })
    })
  });
}


/**
 * Create a new URL handle
 * @param {string} method 
 * @param {string} path 
 * @param {function} callback 
 * @param {any} requirements 
 */
App.prototype.bind = function(method, path, callback, requirements){
  let bind = new Binding(method, path, callback, requirements);
  this.binding.push(bind);

  return bind;
}
/**
 * 
 * @param {string[]} paths 
 * @param {function} validityTestor 
 * @param {function} denied 
 * @param {string[]} ignore 
 */
App.prototype.addAuth = function(paths, validityTestor, denied, ignore){
  let auth = new Authenticator(paths, validityTestor, denied, ignore);
  this.auth.push(auth);

  return auth;
}


/*----------------------------------------------------------------------
    Setup simple binding macros
----------------------------------------------------------------------*/
App.prototype.get = function(path, callback, requirements = {}){
  if (!requirements.form){
    requirements.form = false;
  }

  this.bind('get', path, callback, requirements);
}
App.prototype.post = function(path, callback, requirements = {}){
  if (!requirements.form){
    requirements.form = 'cache';
  }

  this.bind('post', path, callback, requirements);
}
App.prototype.put = function(path, callback, requirements = {}){
  if (!requirements.form){
    requirements.form = true;
  }

  this.bind('put', path, callback, requirements);
}
App.prototype.delete = function(path, callback, requirements = {}){
  if (!requirements.form){
    requirements.form = false;
  }

  this.bind('delete', path, callback, requirements);
}
App.prototype.patch = function(path, callback, requirements = {}){
  if (!requirements.form){
    requirements.form = true;
  }

  this.bind('patch', path, callback, requirements);
}