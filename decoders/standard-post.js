const EventEmitter = require('events');
var fs = require('fs');

module.exports = function(stream){
  var listener = new EventEmitter();
  var last;

  stream.on('data', function(data){
    data = data.toString();

    var working = true;
    var content;
    while (working && data.length > 0){
      var equal = data.indexOf('=');
      var split = data.indexOf('&');

      if (equal !== -1 && (equal < split || split === -1)){
        if (last){
          listener.emit('end', last, {name: last});
        }

        last = data.slice(0, equal);
        data = data.slice(equal+1);
      }else if (split !== -1 && (equal > split || equal === -1)){
        content = decodeURIComponent(data.slice(0, split).replace(/([+])+/g, ' '));

        listener.emit('data', last, {name: last}, content);
        data = data.slice(split+1);
      }else{
        content = decodeURIComponent(data.replace(/([+])+/g, ' '));

        listener.emit('data', last, {name: last}, content);
        working = false;
        data = '';
        break;
      }
    }
  });

  stream.on('end', function(){
    listener.emit('finish');
  });

  return listener;
};
