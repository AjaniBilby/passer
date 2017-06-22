# Setup
```
  var js = require('./decoders/json-stream.js');
  var listener = js(stream);
```

# Events

## listener.on('data', [function] (feildname, otherInfo, chunk))
When all data is decoded from stream

## listener.on('finish', [function])
When the stream is done decoding
