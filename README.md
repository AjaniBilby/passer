A simple NodeJS server request manager

[NPM stats](https://nodei.co/npm/passer.png)
[![Known Vulnerabilities](https://snyk.io/test/npm/passer/badge.svg)](https://snyk.io/test/npm/passer)

## Setup
```
var passer = require('passer');

var serverToPipeForSockets = passer.listen(8080);
```



# Request Management

Supported Methods:
- Get
- Post
- Put
- Delete
- Patch
- Custom

All bindings allow for wildcard characters for instance;
Request ```/user/36Ab9z-cat/profilePic``` will activate ```/user/*/profilePic```
___*___ represents any number of any characters
Note items binded before others will have higher priority

## On Request Get
```
passer.get('/test', function(req, res){
  res.write('HELLO WORLD!!!\n');
  res.write('Session ID:'+req.session.id+'\n');
  res.end('END');
});
```

### Request Post
Currently Supports:
  - Standard Post (www form urlencoded)
  - Multipart Form-data
  - JSON
```
passer.post('/someURL', function(req,res){
  req.form.on('field', function(feildname, info, data){
    //Received some data for a field
  });
  req.forms.on('end', function(){
    //All data for the field has been received
  });
  req.forms.on('finish', function(){
    //All data for, form has been received
  });
});
```

### Custom
```
passer.bind(method[String], path[String], callback[Function], requirements[Object])
```

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
  res.statusCode = 404;
  res.end("Cannot find "+req.url);
}
```

## HTML header file
If you defined a header file then it will auto merge the body, and header of a html file. If query key "?noHeader" is in the request url then it will just serve the html file without the header file.
```
passer.headerFile = "./public/header.html";
```




# Client Data

## Sessions
```
passer.noSession = false; //Default: false

passer.get('/', function(req, res){
  var sessionInfo = req.session; //User's session data

  if (!sessionInfo.someTagName){ //If defined
    res.end('You have been here before and had your someTagName set to:'+sessionInfo.someTagName);
  }else{
    res.end('FIRST TIME!');
  }

  sessionInfo.someTagName = "value";
});
```

### Session Expiry
The length of time it takes for a session to expire it defined via.
```
passer.sessionExpiry = 3*60*60*1000 //3hrs in ms, this is the default value
```

### Disable Sessions
```
passer.noSession = true;
```



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

## Path
```
passer.get('/', function(req, res){
  console.log('Path no queries: '+req.path);
  console.log('Path with queries:'+req.url);
});
```




# Authorization
__addAuth(pathsInZone[Array String], tester[function], onFailTest[function], ignorePaths[Array String]);__
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
