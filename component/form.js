const EventEmitter = require('events');
const query = require('querystring');
const fs = require('fs');

/**
 * Decode a form
 * @param {any} req 
 */
function Decode(req){
  req.form = new EventEmitter();
  //data: when a field is decoded
  //end: when there are no more fields left

  switch (req.headers['content-type']){
    case 'application/json':
      Json(req);
      break;
    case 'application/x-www-form-urlencoded':
      Standard(req);
      break;
    default:
      if (req.headers['content-type'].indexOf('multipart/form-data;') == 0){
        Multipart(req);
        break;
      }

      req.form.emit('finish');
  }

  return;
}



let bs = 'multipart/form-data; boundary='.length;
function Multipart(req){
  let boundry = '--'+req.headers['content-type'].slice(bs);
  let buffer = new Buffer([]);
  let mimeType = null;
  let field = null;

  let stream = fs.createWriteStream('temp.txt');
  req.pipe(stream);

  req.on('data', (chunk)=>{
    buffer = Buffer.concat([buffer, chunk]);
    
    let i = buffer.indexOf(boundry);
    while (i != -1){
      if (field){
        if (i == -1){  //parse all data upto the end of the chunk
          req.form.emit('data', field, buffer);
          buffer = buffer.slice(buffer.length);
          return;
        }else{         //parse all data upto the next boundry
          req.form.emit('data', field, buffer.slice(0, i-2));
          buffer = buffer.slice(i);
        }
      }else if (i == -1){
        //There is something wrong with the start of this post
        console.warn('Bad multipart form');
        req.close();
        return;
      }
  
      buffer = buffer.slice(boundry.length);

      if (buffer[0] == '-' && buffer[1] == '-'){//It's the end of the post
        return;
      }
      buffer = buffer.slice(40);
      
      field = buffer.slice(0, buffer.indexOf('"'));
      buffer = buffer.slice(buffer.indexOf('\r\n')+2);
  
      if (buffer.indexOf('Content-Type: ') == 0){
        let i = buffer.indexOf('\r\n');
        mimeType = buffer.slice(14, i);
        buffer = buffer.slice(i+2);
      }else{
        mimeType = null;
      }
      buffer = buffer.slice(2);
  
      i = buffer.indexOf(boundry);
    }
  })

  req.on('end', ()=>{
    req.form.emit('end');
  })
}




function Json(req){
  let buffer = '';

  req.on('data', (chunk)=>{
    buffer += chunk;
  })
  req.on('end', ()=>{
    let data = null;
    try{
      data = JSON.parse(buffer);
    }catch(e){}

    req.form.emit('data', 'json', data);
    req.form.emit('end');
  });
}




function Standard(req){
  let buffer = "";

  req.on('data', (chunk)=>{
    buffer += chunk;
  })
  req.on('end', ()=>{
    data = query.parse(buffer);
    for (key in data){
      req.form.emit('data', key, data[key]);
    }

    req.form.emit('end');
  })
}


module.exports = {
  decode: Decode
}