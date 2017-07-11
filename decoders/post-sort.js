var sp = require('./standard-post.js');
var mp = require('./multipart-form.js');
var js = require('./json-stream.js');

module.exports = function(req, res){	
  if (req.headers['content-type'].indexOf('multipart/form-data') === 0){
    var boundry = req.headers['content-type'].split('=');
    if (boundry[1]){
      boundry = boundry[1];
    }else{
      boundry = undefined;
    }
    req.form = mp(req, boundry);
  }else if (req.headers['content-type'] === 'application/json'){
		req.form = js(req);
  }else if (req.headers['content-type'] === 'application/x-www-form-urlencoded'){
    req.form = sp(req);
  }else{
    req.form = null;
  }
};
