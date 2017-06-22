const EventEmitter = require('events');

module.exports = function(stream){
  var listener = new EventEmitter();

  if (typeof(callback) != 'function'){
    return;
  }

  var body = '';

  stream.on('data', function(chunk){
    body += chunk;
  });

  stream.on('end', function(){
    var json = null;
    var err = null;

    try{
      json = JSON.parse(body);
    }catch(e){
      err = e;
    }

    listener.emit('data', 'data', {name: 'data', json: true}, data);
    listener.emit('finish');
  });

  return listener;
};
