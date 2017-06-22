const EventEmitter = require('events');
var fs = require('fs');

module.exports = function(stream, boundry){
  var listener = new EventEmitter();

  var id = boundry;
  var first = true;
  var ended = false;
  var forms = {};
  var lastName;

  var dispositionNext = false;
  var spacerNext = false;

  stream.on('data', function(data){
    if (ended){
      return;
    }

    var index;
    if (first){
      index = data.indexOf('\n');
      id = data.slice(0, index-1).toString();
    }

    index = data.indexOf('\r\n');
    while (index != -1){
      var content = data.slice(0, index+2);
      data = data.slice(index+2);

      if (content.indexOf(id) === 0){
        if (content.slice(id.length).indexOf('--') === 0){
          listener.emit('finish');
          ended = true;
          break;
        }else{
          dispositionNext = true;
        }
      }else{
        if (dispositionNext && content.indexOf('Content-Disposition:') === 0){
          content = content.slice(21);

          if (content.indexOf('form-data; ') === 0){
            content = content.slice(11, -2);

            var info = {};
            content = content.toString().split('; ');
            for (let item of content){
              item = item.split('=');
              info[item[0]] = item[1].slice(1, -1);
            }

            if (lastName){
              listener.emit('end', lastName, new Object(forms[lastName]));
            }

            if (info.name){
              forms[info.name] = info;
              lastName = info.name;
            }

            dispositionNext = false;
            spacerNext = true;
          }
        }else if (spacerNext){
          if (content.indexOf('Content-Type: ') === 0){
            content = content.slice(14);
            forms[lastName]['Content-Type'] = content;
          }else{
            spacerNext = false;
          }
        }else{
          if (lastName){
            if (content.indexOf('\r\n') === content.length-2){
              if (data.indexOf(id) === 0){
                content = content.slice(0, content.length-2);
              }
            }

            listener.emit('data', lastName, new Object(forms[lastName]), content);
          }
        }
      }

      index = data.indexOf('\r\n');
    }

    first = false;
  });

  //Incase the post is missing the end for some reason
  stream.on('end', function(){
    if (!ended){
      ended = true;
      listener.emit('end', lastName, new Object(forms[lastName]));
      listener.emit('finish');
    }
  });

  return listener;
};
