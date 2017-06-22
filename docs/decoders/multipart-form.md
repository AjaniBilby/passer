# Setup
```
  var mp = require('./decoders/multipart-form.js');
  var listener = mp(stream);
```

# Events

## listener.on('data', [function] (feildname, otherInfo, chunk))
When data is received for a form

## listener.on('end', [function] (feildname, otherInfo))
When a feild is finished

## listener.on('finish', [function])
When the stream is done decoding
