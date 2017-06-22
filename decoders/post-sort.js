var sp = require('./standard-post-form.js');
var mp = require('./multipart-form.js');
var js = require('./json.stream.js');

module.exports = function(req, res){
  if (req.headers['content-type'].indexOf('multipart/form-data') === 0){
    var boundry = req.headers['content-type'].split('=');
    if (boundry[1]){
      boundry = boundry[1];
    }else{
      boundry = undefined;
    }
    req.form = mp(req.body, boundry);
  }else if (req.headers['content-type'] === 'application/json'){
    req.form = js(req.body);
  }else if (req.headers['content-type'] === 'application/x-www-form-urlencoded'){
    req.form = sp(req.body);
  }else{
    req.form = null;
  }
};
