//TODO make sure that file transfer works

const EventEmitter = require('events');
var random = require('mass-random');
var fs = require("fs");
var object = require("object-manipulation");
var Busboy = require('busboy');

class UserSession{
  constructor(ip, app){
    this.appRef = app;
    var id=null;

    //Check if there is no possible id numbers to use in current set, if so expand set length
    if (this.appRef.sessions.count+1 >= this.appRef.sessions.keyLength*30){
      console.log("***Error***: ran out of unique id numbers, expanding key length");
      this.appRef.sessions.keyLength += 5;
    }

    //Get new unique ID
    while (id === null || typeof(this.appRef.sessions.usedIDs[id]) === "string"){
      id = random.string(this.appRef.sessions.keyLength);
    }

    //Create unique session
    this.ip = ip.toString();
    this.creation = Date.now();
    this.lastActive = Date.now();
    this.id = id;
    this.index = this.appRef.sessions.usedIDs.length;
    this.appRef.sessions.usedIDs.push(id);

    this.appRef.sessions.ids[id] = this;
    this.appRef.sessions.ids[id]._cache = {};
    this.timerReset();

    this.appRef.sessions.count += 1;

    return this.appRef.sessions.ids[id];
  }

  get data(){
    return this.appRef.sessions.ids[this.id]._cache || {};
  }

  set data(value){
    this.appRef.sessions.ids[this.id]._cache = value;
    return this.appRef.sessions.ids[this.id]._cache;
  }
}
UserSession.prototype.timerReset = function(){
  this.lastActive = Date.now();

  if (this.appRef.sessions.ids[this.id].timer){
    //delete old timer
    clearTimeout(this.appRef.sessions.ids[this.id].timer);
  }

  //Setup timeout
  this.appRef.sessions.ids[this.id].timer = setTimeout(function(app, id){
    app.sessions.ids[id].delete();
  }, module.exports.sessionTimeout*3600000, this.appRef, this.id);
};
UserSession.prototype.delete = function(){
  this.appRef.sessions.count -= 1;
  this.appRef.sessions.usedIDs.splice(this.index);
};


class App{
  constructor(){
    this.isSub = false;
    this.live = true;
    this.publicFolder = null;
    this.headerFile = null;
    this.sessions = {
      ids: {},
      keyLength: 20,
      count: 0,
      usedIDs: []
    };
    this.handlers = {
      functions: {
        get: [],
        post: []
      },
      list: {
        get: [],
        post: []
      },
      requirements: {
        get: [],
        post: []
      }
    };
    this.authenticators = [];
    this.analytics = null;
  }
}
App.prototype.IsValidSession = function(req){
  if (!req.sessionChecked){
    if (typeof(req.cookies.session) == "string"){
      if (typeof(this.sessions.ids[req.cookies.session]) == "object"){
        req.session = this.sessions.ids[req.cookies.session];
        req.session.timerReset(); //Reset due to activity
        req.validSession = true;

        return true;
      }
    }
  }

  return false;
};
App.prototype.getQueries = function(queryString){
  var query = {};
  parts = [];
  if (queryString.indexOf('&') != -1){
    parts = queryString.split('&');
  }else{
    parts = [queryString];
  }

  query = {};
  for (let item of parts){
    if (item.indexOf('=') != -1){
      item = item.split('=');
      query[item] = item.splice(1).join('=');
    }else{
      query[item] = true;
    }
  }

  return query;
};
App.prototype.onRequest = function(req, res, checkURL){
  if (!this.isSub || !checkURL){
    /*--------------------------------------------------------------
        Get Cookies
    --------------------------------------------------------------*/
    req.cookies = {};
    if (req.headers && req.headers.cookie){
      parts = req.headers.cookie.split(';');
      for (let item of parts){
        var sections = item.split('=');
        var name = sections[0];
        while(name[0] == " "){
          name = name.splice(1);
        }
        sections = sections.splice(1); //Remove name
        req.cookies[name] = sections.join('='); //Merg any other = signs that may be in the cookie
      }

      //Cleanup
      delete parts;
    }


    /*--------------------------------------------------------------
        Get Querys
    --------------------------------------------------------------*/
    req.queryString = req.url.split('?').splice(1).join('?');
    req.query = this.getQueries(req.queryString);
  }



  /*--------------------------------------------------------------
      Get Authorization
  --------------------------------------------------------------*/
  if (!this.IsAuthorized(req, res)){
    return;
  }



  /*--------------------------------------------------------------
      Run URL Handles
  --------------------------------------------------------------*/
  var method = req.method.toLowerCase();
  var location = req.url;
  var queryStart = location.indexOf('?');
  var anchor = location.indexOf('#');
  if (anchor < queryStart && anchor != -1){
    location = location.substr(0, anchor);
  }else if (queryStart != -1){
    location = location.substr(0, queryStart);
  }

  for (let index in this.handlers.list[method]){
    if (PathTester(this.handlers.list[method][index], location)){
      if (!this.IsValidSession(req)){
        res.writeHead(302, {
          'Location': 'http://'+req.headers.host+location,
          'Set-Cookie': "session="+new UserSession(req.connection.remoteAddress, this).id+';path=/'
        });
        res.end("redirecting");
        return true;
      }

      req.forms = new EventEmitter();
      req.body = req.forms;

      var app = this;

      var busboy = new Busboy({ headers: req.headers });
      busboy.on('file', function(fieldname, file, filename, encoding, mimetype) {
        req.forms[fieldname] = {
          data: new Buffer(''),
          filename: filename,
          encoding: encoding,
          mimetype: mimetype,
          stream: file,
          inprogress: true
        };
        file.on('data', function(data) {
          req.forms[fieldname].data = new Buffer(req.forms[fieldname].data+data);
        });
        file.on('end', function() {
          req.forms[fieldname].inprogress = false;
        });

        req.forms.emit('file', fieldname, req.forms[fieldname]);
      });
      busboy.on('field', function(fieldname, val, fieldnameTruncated, valTruncated, encoding, mimetype){
        req.forms[fieldname] = val;
        req.forms.emit('field', fieldname, req.forms[fieldname]);
      });
      busboy.on('finish', function(){
        if (app.handlers.requirements[method][index].fullBody){
          app.handlers.functions[method][index](req, res);
        }

        req.forms.emit('finish', req.forms);
      });
      req.pipe(busboy);

      if (!app.handlers.requirements[method][index].fullBody){
        app.handlers.functions[method][index](req, res);
      }

      return true;
    }
  }




  /*--------------------------------------------------------------
      Create Session
  --------------------------------------------------------------*/
  if (!this.IsValidSession(req)){
    res.writeHead(302, {
      'Location': 'http://'+req.headers.host+location,
      'Set-Cookie': "session="+new UserSession(req.connection.remoteAddress, this).id+';path=/'
    });
    res.end("redirecting");
    return true;
  }



  /*--------------------------------------------------------------
      Get extention
  --------------------------------------------------------------*/
  var page = req.url;
  if (page == '/'){
    page = '/index';
  }


  var queryStart = page.indexOf('?');
  var anchorStart = page.indexOf('#');
  if (anchor < queryStart && anchor != -1){
    page = page.substr(0, anchor);
  }else if (queryStart != -1){
    page = page.substr(0, queryStart);
  }

  if (page.indexOf('.') != -1){
    req.extention = page.split('.');
    req.extention = req.extention[req.extention.length-1];
  }else{
    req.extention = 'html';
  }




  /*--------------------------------------------------------------
      Parse file
  --------------------------------------------------------------*/
  if (this.publicFolder !== null){
    page = this.publicFolder + page;
    if (page.indexOf('.') === -1){
      page += '.' + req.extention;
    }

    var sendHeaderFile = false;

    if (!req.query.noHeader && !req.sentHeaderFile){
      req.sentHeaderFile = true;
      sendHeaderFile = true;
    }

    if (this.parseFile(page, req, res, sendHeaderFile)){
      return true;
    }
  }

  //If not exist
  this.on404(req, res);
  return false;
};
App.prototype.parseFile = function(file, req, res, includeHeaderFile){
  //Does the file exist?
  if (fs.existsSync(file)){
    if (req.extention != 'html' && module.exports.documentTypes[req.extention] !== undefined){
      res.writeHead(200, {'Content-Type': module.exports.documentTypes[req.extention]});
    }else{
      if (includeHeaderFile){
        if (typeof(this.headerFile) == "string"){
          //Using sync to make sure that the file gets sent NOW so that it doesn't end up ever getting sent after a res.end();
          if (fs.existsSync(this.headerFile)){
            res.write(fs.readFileSync(this.headerFile).toString());
          }
        }
      }
    }
    var stream = fs.createReadStream(file);
    stream.on('data', function(chunk){
      res.write(chunk);
    });
    stream.on('end', function(chunk){
      res.end();
    });
    return true;
  }

  return false;
};
App.prototype.on404 = function(req, res){
  //Error 404
  res.writeHead(404);
  res.end("Cannot find "+req.url);
};
App.prototype.IsAuthorized = function(req, res){

  for (let rule of this.authenticators){
    for (let ignorePath of rule.ignore){
      if (PathTester(ignorePath, req.url)){
        return true;
      }
    }

    for (let restricted of rule.paths){
      if (PathTester(restricted, req.url)){
        if(!this.IsValidSession(req)){ //Get session incase it is needed in validity test
          res.writeHead(302, {
            'Location': 'http://'+req.headers.host+req.url,
            'Set-Cookie': "session="+new UserSession(req.connection.remoteAddress, this).id+';path=/'
          });
          res.end("redirecting");
          return null;
        }

        if (!rule.validity(req)){
          console.log('denied');
          rule.denied(req, res);
          return false;
        }
      }
    }
  }

  return true;
};
App.prototype.addAuth = function(paths, validityTestor, denied, ignore){
  if (paths.length > 0 && typeof(validityTestor) == "function" && typeof(denied) == "function"){
    this.authenticators.push({paths: paths, validity: validityTestor, ignore: ignore, denied: denied});
  }else{
    //Error
    if (!paths || paths.length <= 0){
      console.error("**ERROR: invalid auth path");
    }
    if (typeof(validityTestor) != "function"){
      console.error("**ERROR: invalid auth validityTestor");
    }
    if (typeof(denied) != "function"){
      console.error("**ERROR: invalid auth denied");
    }
    return false;
  }
};
App.prototype.listen = function(port = 8000){
  var app = this;

  var server = require('http').Server(function(req, res){
    var success = app.onRequest(req, res);
    /*
    NOTE
      null = restarting connection due to no session ID
      true = everything worked properly
      false = error 404
    */
    if (success === true && app.analytics !== null){
      app.analytics.activity(req, res);
    }
  });

  server.listen(port, function(){
    console.log('Server is listening at port '+port);
  });

  return server;
};
App.prototype.setAnalytics = function(packageData){
  this.analytics = packageData;
  this.analytics.sessions = sessions;
};
App.prototype.get = function(path, callback, options = {fullBody: false}){
  path = path.toLowerCase();
  var index = this.handlers.list.get.length;
  this.handlers.list.get[index] = path;
  this.handlers.functions.get[index] = callback;
  this.handlers.requirements.get[index] = options;
};
App.prototype.post = function(path, callback, options = {fullBody: true}){
  path = path.toLowerCase();
  var index = this.handlers.list.post.length;
  this.handlers.list.post[index] = path;
  this.handlers.functions.post[index] = callback;
  this.handlers.requirements.post[index] = options;
};


function PathTester(path, location){
  path = path.toLowerCase();
  location = location.toLowerCase();

  var queryStart = location.indexOf('?');
  var anchor = location.indexOf('#');
  if (anchor < queryStart && anchor != -1){
    location = location.substr(0, anchor);
  }else if (queryStart != -1){
    location = location.substr(0, queryStart);
  }

  if (path.indexOf('*') == -1){
    return path === location;
  }else{
    path = path.split('*');
    var index = -1;
    for (let part of path){
      if (part !== ''){
        var partLoc = location.indexOf(part);

        if (index < partLoc){
          index = partLoc;
        }else{
          return false;
        }
      }
    }
    return true;
  }

  return false;
}






module.exports = new App();
module.exports.app = App;
module.exports.documentTypes = {
  "aac": "audio/aac",
  "aifc": "audio/aiff",
  "aiff": "audio/aiff",
  "au": "audio/basic",
  "snd": "audio/basic",
  "mid": "audio/mid",
  "midi": "audio/mid",
  "rmi": "audio/mid",
  "m4a": "mp4",
  "mp3": "audio/mpeg3",
  "oga": "audio/ogg",
  "spx": "adt",
  "adt": "audio/vnd.dlna.adts",
  "wav": "audio/wav",
  "aif": "audio/x-aiff",
  "m3u": "audio/x-mpegurl",
  "wax": "audio/x-ms-wax",
  "wma": "audio/xms-wma",
  "ra": "audio/x-pn-realaudio",
  "ram": "audio/x-pn-realaudio",
  "rpm": "audio/x-pn-realaudio-plugin",
  "smd": "audio/x-smd",
  "smx": "audio/x-smd",
  "smz": "audio/x-smd",
  "odf": "font/odf",
  "woff": "font/x-woff",
  "gif": "image/gif",
  "ief": "image/ief",
  "jpe": "image/jpeg",
  "jpeg": "image/jpeg",
  "jpg": "image/jpeg",
  "jfif": "image/pjipeg",
  "png": "image/png",
  "pnz": "image/png",
  "svg": "image/svg+xml",
  "svgz": "image/svg+xml",
  "tif": "image/tiff",
  "tiff": "image/tiff",
  "rf": "image/vnd.rn-realflash",
  "wbmp": "image/vnd.wap.wbmp",
  "ras": "image/x-cmu-raster",
  "cmx": "image/x-cmu",
  "ico": "image/ico",
  "art": "image/x-jg",
  "pnm": "image/x-portable-anymap",
  "pbm": "image/x-portable-bitmap",
  "rgb": "image/x-rgb",
  "xbm": "image/x-xbitmap",
  "xpm": "image/x-xpixmap",
  "xwd": "image/x-xwindowdump",
  "eml": "message/rfc822",
  "mht": "message/rfc822",
  "mhtml": "message/rfc822",
  "nws": "message/rfc822",
  "appcache": "text/cache-manifest",
  "ics": "text/calendar",
  "css": "text/css",
  "less": "text/css",
  "dlm": "text/dlm",
  "323": "text/h323",
  "htm": "text/html",
  "html": "text/html",
  "hxt": "text/html",
  "uls": "text/iuls",
  "jsx": "text/jscript",
  "asm": "text/plain",
  "bas": "text/plain",
  "c": "text/plain",
  "cnf": "text/plain",
  "cpp": "text/plain",
  "h": "text/plain",
  "map": "text/plain",
  "txt": "text/plain",
  "vcs": "text/plain",
  "xdr": "text/plain",
  "rtx": "text/rich",
  "sct": "text/scriptlet",
  "sgml": "text/sgml",
  "tsv": "text/tab-separated-values",
  "vbs": "text/vbscript",
  "wml": "text/vnd.wrap.wml",
  "wmls": "text/vnd.wap.wmlscript",
  "htt": "text/webviewhtml",
  "htc": "text/x-component",
  "hdml": "text/x-hdml",
  "disco": "text/xml",
  "dll.config": "text/xml",
  "dtd": "text/xml",
  "exe.config": "text/xml",
  "mno": "text/xml",
  "vml": "text/xml",
  'wsdl': 'text/xml',
  'xml': 'text/xml',
  'xsd': 'text/xml',
  "xsf": 'text/xml',
  'xsl': 'text/xml',
  'xslt': 'text/xml',
  'odc': 'text/x-ms-doc',
  'etx': 'text/x-setext',
  'vcf': 'text/x-vcard',
  '3gp': 'video/3gpp',
  '3gpp': 'video/3gpp',
  '3g2': 'video/3gpp2',
  '3gp2': 'video/3gpp2',
  'avi': 'video/avi',
  'm4v': 'video/mp4',
  'mp4v': 'video/mpeg',
  'm1v': 'video/mpeg',
  'mp2': 'video/mpeg',
  'mpa': 'video/mpeg',
  'mpeg': 'video/mpeg',
  'mpg': 'video/mpeg',
  'mpv2': 'video/mpeg',
  'ogg': 'video/ogg',
  'ogv': 'video/ogg',
  'mov': 'video/quicktime',
  'qt': 'video/quicktime',
  'm2ts': 'video/vnd.dlna.mpeg-tts',
  'ts': 'video/vnd.dlna.mpeg-tts',
  'tts': 'video/vnd.dlna.mpeg-tts',
  'webm': 'video/webm',
  'flv': 'video/x-flv',
  'ivf': 'video/x-ivf',
  'lsf': 'video/x-la-asf',
  'lsx': 'video/x-la-asf',
  'asf': 'video/x-ms-asf',
  'asr': 'video/x-ms-asf',
  'asx': 'video/x-ms-asf',
  'nsc': 'video/x-ms-asf',
  'dvr-ms': 'video/x-ms-dvr',
  'wm': 'video/x-ms-wm',
  'wmv': 'video/x-ms-wmv',
  'wmx': 'video/x-ms-wmx',
  'wtv': 'video/x-ms-wtv',
  'wvx': 'video/x-ms-wvx',
  'movie': 'video/x-sgi-movie',
  'flr': 'x-world/x-vrml',
  'wrl': 'x-world/x-vrml',
  'wrz': 'x-world/x-vrml',
  'xaf': 'x-world/x-vrml',
  'xof': 'x-world/x-vrml'
};
