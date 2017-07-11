var passer = require('./../passer.js');

passer.publicFolder = './test/public';
passer.listen(8080);

passer.post('/post', function(req, res){
	console.log(req.headers['content'], req.form);
	
	if (req.form === null){		
		res.statusCode = 400;
		res.end();
		return;
	}
	
	req.form.on('data', function(feildname, info, data){
		console.log(feildname, info, data);
	});
});

// passer.addAuth(['/*'], function(req){
// 	console.log(req.method, req.url);
// 	return true;
// }, function(){}, []);