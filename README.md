**NodeJS server essentials**

![NPM stats](https://nodei.co/npm/passer.png)  
[![Known Vulnerabilities](https://snyk.io/test/npm/passer/badge.svg)](https://snyk.io/test/npm/passer)

# Setup

```javascript
var serv = require('passer');
serv.listen(8080);
```



# Bindings
Passer allows for easy url binding
```javascript
serv.get('/', (req, res)=>{
  res.end('Index page live');
});
```
This can be done for many more request methods than just *get*.
It can also be done for; **post**, **put**, **patch**, **delete**. As well as the ability to bind to custom methods.

&nbsp;&nbsp;&nbsp;**Custom Binding**: ``serv.bind([method], [url], [callback], [requirements]);``

## URL
Parser has a built in wildcard system, so binding urls do not need to exactly match the actual request url.  
&nbsp;&nbsp;``+`` &nbsp;&nbsp;  Will represent a single wild charater.  
&nbsp;&nbsp;``*`` &nbsp;&nbsp; Will represent zero to many wild characters.  
&nbsp;&nbsp;``\\`` &nbsp; Before one of the previouse characters will allow your binding url to include a litteral ``+`` or ``*`` character.  

The data at each wildcard can also be received. The characters in place of the wild cards will be stored in ``req.wildcards``, in order of which they occur.



# Request Data

You can also get specific request data which has already been decoded via a binding.  
**Cookies:** &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;``req.cookies``  
**Query Values:** &nbsp;``req.query``  
**Plain URL:** &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;``req.path`` (doesn't include a query string)  
**Extension:** &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;``req.extension``



# Form data
Passer has built in form decoders to make use a breeze.
However these bindings are only set if the binding requirement value ``form`` is set to either ``true`` or ``cache``.  
By default **post**, **put**, **patch**, **delete** all have these bindings setup. Also **post** has it set to ``cache`` not ``true``.

If a binding is set to cache the form, then all form values will be available within ``req.form.data``, also the binding function will only be triggered after the form has been fully received. Otherwise form activity will be parsed though events.

``req.form.on('data', (fieldName, fieldData)=>{})`` Will be triggered anytime data for the specified field is received. **Note**: Then entire field's data may not be parsed in one call, instead it may be sent via multiple events non-consecutivly.
``req.form.on('end', ()=>{})`` Will be triggered when all form data has been decoded, and parsed though the on ``data`` event.

Built in form encoding types are; **standard url encode**, **multipart**, **json**.



# Sessions
Parse has a built in session system which can be accessed within any binding.  
All session data tied to a given requester can be accesser via ``req.session.data``.  
However if you project does not require sessions, and you do not want to waste extra processing power, the session system can be disabled via;
```javascript
serv.hasSessions = false;
```
You can also change the amount of time before a session expires via (in milliseconds);
```javascript
serv.treasury.sessionExpiry = 1000 * 60 * 60 * 3; //3h is the default value
```



# Authorization
There is a built in system to allow the blocking of certaint urls via a specific rule.  
This is done via ``serv.addAuth(paths[], testor(), denied(), ignore[])``

**Example**
```javascript
serv.addAuth(['/admin/*'], (req)=>{
  return req.session.data.loggedIn && req.session.data.admin;
}, (req, res)=>{
  res.end('You do not have admin permissions');
}, ['/admin/login'])
```



# File Parsing
If you set ``serv.publicFolder`` to the path of a folder, then when a request occurs that does not reach a binding, then it will attempt to parse a file from that directory.  
This functionality can also be manually called from a binding using ``serv.parseFile(req, res, pathToFile)``



# Uncaught URLs
By default urls that do not trigger a bind and that don't trigger a file to be parsed will run the ``serv.on404()`` function.  
This can then be remapped via;
```javascript
serv.on404 = (req, res)=>{
  res.statusCode = 404;

  //Your custom action here
}
```



# Document MimeTypes
You can use passers inbuilt mimetype library for your own use via;
```javascript
serv.documentTypes['mp3']; //will return 'audio/mpeg3'
```