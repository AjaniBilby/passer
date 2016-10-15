var random = require("mass-random");
var fs = require("fs");
var object = require("object-manipulation");
var analytics = null;





class UserSession{
  constructor(ip){
    var id=null;

    //Check if there is no possible id numbers to use in current set, if so expand set length
    if (sessions.count+1 >= sessions.keyLength*30){
      console.log("***Error***: ran out of unique id numbers, expanding key length");
      sessions.keyLength += 5;
    }

    //Get new unique ID
    while (id === null || typeof(sessions.usedIDs[id]) === "string"){
      id = random.string(sessions.keyLength);
    }

    //Create unique session
    this.ip = ip.toString();
    this.creation = Date.now();
    this.lastActive = Date.now();
    this.id = id;
    this.index = sessions.usedIDs.length;
    sessions.usedIDs.push(id);

    sessions.ids[id] = this;
    sessions.ids[id]._cache = {};
    this.timerReset();

    sessions.count += 1;

    return sessions.ids[id];
  }

  get data(){
    return sessions.ids[this.id]._cache || {};
  }

  set data(value){
    sessions.ids[this.id]._cache = value;
    return sessions.ids[this.id]._cache;
  }
}

UserSession.prototype.timerReset = function(){
  this.lastActive = Date.now();

  if (sessions.ids[this.id].timer){
    //delete old timer
    clearTimeout(sessions.ids[this.id].timer);
  }

  //Setup timeout
  sessions.ids[this.id].timer = setTimeout(function () {
    sessions.ids[this.id].delete();
  }, module.exports.sessionTimeout*3600000);
};

UserSession.delete = function(){
  sessions.count -= 1;
  session.usedIDs.splice(this.index);
};






var sessions = {
  ids: {},
  keyLength: 20,
  count: 0,
  usedIDs: []
};

var handlers = {
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

function IsValidSession(req, res){
  if (typeof(req.cookies.session) == "string"){
    if (typeof(sessions.ids[req.cookies.session]) == "object"){
      req.session = sessions.ids[req.cookies.session];
      req.session.timerReset(); //Reset due to activity
      return true;
    }
  }

  return false;
}

function pathTester(path, location){
  if (path.indexOf('*') == -1){
    //If there is no star
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



function OnRequest(req, res){
  req.cookies = module.exports.getCookies(req);
  //get query
  if (req.url.indexOf("?") != -1){
    req.query = module.exports.getQueries(req.url.split("?")[1]);
  }else{
    req.query = {};
  }

  //Get extention
  page = req.url.split("?")[0].toLowerCase();
  if (page == "/"){
    page="/index";
  }
  req.extention = page.split('/');
  req.extention = req.extention[req.extention.length-1];
  if (req.extention.indexOf(".") == -1){
    req.extention = ".html";
  }else{
    req.extention = req.extention.substr(req.extention.indexOf("."));
  }

  page = "./"+module.exports.publicFolder+page;

  if (req.method == "GET"){
    var url = req.url.split("?")[0].toLowerCase();

    for (var i=0; i<handlers.list.get.length; i++){

      if (pathTester(handlers.list.get[i], url.split("?")[0])){

        if (!IsValidSession(req)){
          res.writeHead(302, {
            'Location': 'http://'+req.headers.host+req.url,
            "Set-Cookie": "session="+new UserSession(req.connection.remoteAddress).id+";path=/"
          });
          res.end("redirecting");
          return null;
        }

        if (handlers.requirements.get[i].fullBody){
          req.body = '';
          req.on('data', function (data) {
            req.body += data;
          });
          req.on('end', function () {
            req.body = module.exports.getQueries(req.body)
            handlers.functions.get[i](req, res);
          });
          return true;
        }else{
          handlers.functions.get[i](req, res);
          return true;
        }

        return true;
      }
    }
  }


  if (req.method == "POST"){
    var url = req.url.split("?")[0].toLowerCase();

    for (var i=0; i<handlers.list.post.length; i++){
      if (pathTester(handlers.list.post[i].split("?")[0], url)){

        if (!IsValidSession(req)){
          res.writeHead(302, {
            'Location': 'http://'+req.headers.host+req.url,
            "Set-Cookie": "session="+new UserSession(req.connection.remoteAddress).id+";path=/"
          });
          res.end("redirecting");
          return null;
        }

        if (handlers.requirements.post[i].fullBody){
          req.body = '';
          req.on('data', function (data) {
            req.body += data;
          });
          req.on('end', function () {
            req.body = module.exports.getQueries(req.body)
            handlers.functions.post[i](req, res);
          });
          return true;
        }else{
          handlers.functions.post[i](req, res);
          return true;
        }

        return true;
      }
    }
  }




  //If there is no handler on the path, try and find a associated file
  if (module.exports.publicFolder !== null){
    page = page + req.extention;
    //Does file exist
    fs.access(page, fs.R_OK | fs.W_OK, function(err){
      if (err !== null){
        module.exports.on404(req,res);
        return false;
      }else{
        if (req.extention != "html"){
          //Make an array of image and video types, then check what type of data you are sending,
          //and then tell the header what type of data to receive
          res.writeHead(200, {'Content-Type': module.exports.documentTypes[req.extention] });
        }else{
          module.exports.sendHeader(req, res);
        }
        //Send file
        fs.readFile(page, function(err,data){
          if (err){
            res.end('<h1>Error</h1>\n'+err);
            module.exports.on404(req,res);
            return false;
          }else{
            res.end(data);
          }
        });
        return true;
      }
    });
  }
}


module.exports = {
  sessionTimeout: 3,
  publicFolder: null,
  headerFile: null,
  analytics: function(packageData){
    analytics = packageData;

    analytics.sessions = sessions;
  },
  documentTypes: {
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
  },
  makeSession: function(ip){
    return MakeSession(ip);
  },
  getCookies: function(request){
    var cookies = {};
    if (request.headers === undefined){
      return cookies;
    }
    if (request.headers.cookie === undefined){
      return cookies;
    }
    var parts = request.headers.cookie.split(';');
    for (i=0; i<parts.length; i++){
      var sections = parts[i].split("=");
      var name = sections[0];
      while(name[0] == " "){
        name = name.slice(1);
      }
      var value = sections.splice(1);
      cookies[name] = value[0];
    }
    return cookies;
  },
  getQueries: function(queryString){
    queryString = queryString.toString();
    var query = {};

    //get each argument
    if (queryString.indexOf("&") != -1){
      queryString = queryString.split("&");
    }else{
      queryString = [queryString];
    }

    for (var i=0; i<queryString.length; i++){
      if (queryString[i].indexOf("=") != -1){
        queryString[i] = queryString[i].split("=");
        query[queryString[i][0]] = queryString[i][1];
      }else{
        query[queryString[i]] = true;
      }
    }

    return query;
  },
  getSession: function(id, ip){
    output = {valid: false, existent: false, err: null, data: null};

    //check for valid inputs
    if (typeof(id) != "string"){
      output.err = "invalid Session string";
      return output;
    }
    if (typeof(ip) != "string"){
      output.err = "invalid IP value";
      return output;
    }
    id = id.toString();
    ip = ip.toString();

    //check values
    if (sessions.usedIDs.indexOf(id) != -1){
      output.existent = true;
      if (sessions.ids[id].ip == ip){
        output.correctIP = true;
        output.valid = true;
        output.data = sessions.ids[id].data;
        return output;
      }else{
        output.err = "In correct IP";
        return output;
      }
    }else{
      output.err = "Session data exists, without index";
      return output;
    }
    output.err = "Unknown server error";
    return output;
  },
  server: function(req, res){
    var success = OnRequest(req, res);
    /*
    NOTE
      null = restarting connection due to no session ID
      true = everything worked properly
      false = error 404
    */
    if (success === true && analytics !== null){
      analytics.activity(req, res);
    }
  },
  listen: function(port){
    const PORT = port || 8000;

    //Load HTTP protocal and start server
    var server = require('http').Server(module.exports.server);

    //Pipe requests to PORT
    server.listen(PORT, function(){
      console.log('Server listening at port '+PORT);
    });

    return server;
  },
  get: function(path, callback, options = {fullBody: false}){
    path = path.toLowerCase();
    var index = handlers.list.get.length;
    handlers.list.get[index] = path;
    handlers.functions.get[index] = callback;
    handlers.requirements.get[index] = options;
  },
  post: function(path, callback, options = {fullBody: true}){
    path = path.toLowerCase();
    var index = handlers.list.post.length;
    handlers.list.post[index] = path;
    handlers.functions.post[index] = callback;
    handlers.requirements.get[index] = options;
  },
  sendHeader: function(req, res){
    if (req.query.noHeader !== true){
      if (typeof(module.exports.headerFile) == "string"){
        //Using sync to make sure that the file gets sent NOW so that it doesn't end up ever getting sent after a res.end();
        if (fs.existsSync(module.exports.headerFile)){
          res.write( fs.readFileSync(module.exports.headerFile).toString() );
        }
      }
    }
  },
  on404: function(req, res){
    //Error 404
    res.writeHead(404);
    res.end("Cannot find "+req.url);
  }
};
