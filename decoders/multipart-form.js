const EventEmitter = require('events');

module.exports = function(stream, boundry){
  var listener = new EventEmitter();

  boundry = "--"+boundry;
  var first = true;
  var forms = {};
  var lastName;

  stream.on('data', function(data){
    while (data.length > 0){
      index = data.indexOf(boundry);

      // All of this data is just the previous feild continuing
      if (index == -1) {
        listener.emit('data', lastName, forms[lastName], data);
        return;
      }
    
      // Push the chunk of any continuing data
      if (index > 0) {
        listener.emit('data', lastName, forms[lastName], data.slice(0, index-2)); // -2 to remove \r\n
        data = data.slice(index);
        continue;
      }

      // Remove boundry tag
      data = data.slice(index+boundry.length);

      // End of form
      if (data.indexOf('--') == 0) {
        return;
      } else {
        // Push message that previous field ended
        if (!first) {
          listener.emit('end', lastName, forms[lastName]);
        } else {
          first = false;
        }

        // Strip off metadata
        let index = data.indexOf('Content-Disposition: form-data; ') + 32;
        data = data.slice(index);
        index = data.indexOf('\r\n\r\n');
        let meta = data.slice(0, index).toString().split('\r\n');
        data = data.slice(index+4);

        // Read form meta-data
        let info = {};
        meta[0] = meta[0].split('; ');
        for (let item of meta[0]){
          item = item.split('=');
          info[item[0]] = item[1].slice(1, -1);
        }

        // Read any extra form meta-data
        for (let i=1; i<meta.length; i++) {
          let item = meta[i].split(': ');
          info[ item[0] ] = item[1];
        }

        // Store field metadata
        if (info.name){
          forms[info.name] = info;
          lastName = info.name;
        }
      }
    }
  });

  //Incase the post is missing the end for some reason
  stream.on('end', function(){
    // Push message that previous field ended
    listener.emit('end', lastName, forms[lastName]);

    // Push message that entire form has been submited
    listener.emit('finish');
  });

  return listener;
};