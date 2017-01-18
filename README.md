A simple NodeJS server request manager   

## Setup
```
var passer = require("passer");

passer.listen(8000);
```   
Or   
```
var passer = require("passer");

const PORT = 8000;

//Load HTTP protocal and start server
var server = require('http').Server(passer.server);

//Pipe requests to PORT
server.listen(PORT, function(){
  console.log('Server listening at port '+PORT);
});
```   



# Request Management

## On Request Get
```
  passer.get('/test', function(req, res){
    res.write('HELLO WORLD!!!\n');
    res.write('Session ID:'+req.session.id+'\n');
    res.end('END');
  });
```


## On Request Post
```
  passer.post('/someURL', function(req, res){
    console.log(req.forms);
  });
```

### Live post
```
passer.post('/someURL', function(req,res){

  req.forms.on('field', function(fieldname){
    console.log('new field data has been received')
  })
  req.forms.on('file', function(fieldname){
    req.forms[fieldname].ramStore = true //This will mean that it will pipe all file data into ram until the post ends and then the file data is dumped
  });

  req.forms.on('finish', function(){
    console.log('Received all data');

    //If the file fieldname was called "file" then all of the data saved to ram would be in req.forms.file.data
  });

}, {fullBody: false}); //post has fullBody set to true by default
```
Note: when full body is enabled the server will have to wait for the client to
send the body as well as the request data, thus it may increase load times.

## Public Files
If you set a value for publicFolder then on request if there is no handler mapped
to that url then it will try and serve a file from set folder before responding with
error 404
```
  passer.publicFolder = "public";
```

## 404
This is the default value, but can be changed
```
  passer.on404 = function(req, res){
    res.writeHead(404);
    res.end("Cannot find "+req.url);
  }
```

## HTML header file
If you defined a header file then it will auto serve that file at the begining
of any HTML file request, unlease there is the query key "?noHeader"
```
  passer.headerFile = "./public/header.html";
```




# Client Data

## Sessions
```
  passer.sessionTimeout = 1; //1h from last request the session will expire (default = 3h)

  passer.get('/', function(req, res){
    var sessionInfo = req.session; //User's session data

    if (!sessionInfo.data.someTagName){ //If defined
      res.end('You have been here before and had your someTagName set to:'+sessionInfo.data.someTagName);
    }else{
      res.end('FIRST TIME!');
    }

    sessionInfo.data.someTagName = "value";
  });
```
### exceptions
passer.sessionFreeZones is an array of urls that will be ignored for session verification (for if you are connecting devices with no cookie functionality).
Recommended not to be used unless necessary.



## Cookies
```
  passer.get('/',function(req,res){
    console.log(req.cookies);
  });
```


## Query Items
```
  passer.get('/',function(req,res){
    console.log(req.query);
  });
```

## Anchor
```
passer.get('/', function(req, res){
  console.log(req.anchor);
});
```

## Location
This is the url with just a path, no anchors or querystrings
```
passer.get('/', function(req, res){
  console.log(req.location);
});
```




# Authorization
addAuth(pathsInZone, tester, onFailTest, ignorePaths);
```
  passer.addAuth(['*'], function(req){
    return req.session.loggedIn;
  }, function(req, res){
    res.writeHead(401);
    res.end('Invalid connection');
  }, ['/login']);
```




# Document MimeTypes
Within passer you can use it as a shortcut to be able to get any mime type based
of a file extention.
```
console.log(passer.documentTypes['mp3']); //will log out: audio/mpeg3
```




# Analitics
Started development, still in early access.
Not recommended use
```
var passer = require("passer");

var analytics = require('passer-analytics');
passer.analytics(analytics);

//Then same as normal setup
```
