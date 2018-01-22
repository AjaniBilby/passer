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
    case 'multipart/form-data':
      Multipart(req);
      break;
    default:
      req.form.emit('finish');
  }

  return;
}




function Multipart(req){}




function Json(req){}




function Standard(req){
  let buffer = "";
  console.log('Starting...');

  req.body.on('data', (chunk)=>{
    console.log('chunk', chunk);
    buffer += chunk;
  })
  req.body.on('end', ()=>{
    console.log(buffer);
  })
}


module.exports = {
  decode: Decode
}