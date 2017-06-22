# Setup
```
  var sp = require('./decoders/standard-post.js');
  var listener = sp(stream);
```

# Events

## listener.on('data', [function] (feildname, otherInfo, chunk))
When data is received for a form

## listener.on('end', [function] (feildname, otherInfo))
When a field is finished

## listener.on('finish', [function])
When the stream is done decoding
