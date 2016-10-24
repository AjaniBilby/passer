A simple NodeJS server request manager   

##Setup
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



#Request Management

##On Request Get
```
  passer.get('/test', function(req, res){
    res.write('HELLO WORLD!!!\n');
    res.write('Session ID:'+req.session.id+'\n');
    res.end('END');
  });
```


##On Request Post
```
  passer.post('/test', function(req, res){
    res.write('HELLO WORLD!!!\n \n');
    res.write('Your Form inputs:'+JSON.stringify(req.body));
    res.end('END');
  });
```

##Public Files
If you set a value for publicFolder then on request if there is no handler mapped
to that url then it will try and serve a file from set folder before responding with
error 404
```
  passer.publicFolder = "public";
```

##404
This is the default value, but can be changed
```
  passer.on404 = function(req, res){
    res.writeHead(404);
    res.end("Cannot find "+req.url);
  }
```

##HTML header file
If you defined a header file then it will auto serve that file at the begining
of any HTML file request, unlease there is the query key "?noHeader"
```
  passer.headerFile = "./public/header.html";
```




#Client Data

##Sessions
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


##Cookies
```
  passer.get('/',function(req,res){
    console.log(req.cookies);
  });
```


##Query Items
```
  passer.get('/',function(req,res){
    console.log(req.query);
  });
```


##Form Inputs
```
  passer.get('/FormMethodGet', function(req, res){
    var forms = req.body;

    console.log(forms);
  }, {fullBody: true});

  passer.post('/FormMethodGet', function(req, res){
    var forms = req.body;

    console.log(forms);
  }); //post has fullBody set to true by default
```   
Note: when full body is enabled the server will have to wait for the client to
send the body as well as the request data, thus it may increase load times.




#Document MimeTypes
Within passer you can use it as a shortcut to be able to get any mime type based
of a file extention.
```
console.log(passer.documentTypes['mp3']); //will log out: audio/mpeg3
```




#Analitics
Started development, still in early access.
Not recommended use
```
var passer = require("passer");

var analytics = require('passer-analytics');
passer.analytics(analytics);

//Then same as normal setup
```
