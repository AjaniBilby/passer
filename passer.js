var query = require('querystring');
var http = require('http');
var fs = require('fs');

var random = require('mass-random');
var ps = require('./decoders/post-sort.js');

var mime = require('mime-types');

class UserSession {
	constructor(ip, app, aimId) {
		this.appRef = app;
		var id = aimId || null;

		if (app.sessions.count + 1 >= app.sessions.keyPossibilities) {
			console.warn('WARN: Too many sesion ids, increasing length');
			app.sessions.keyPossibilities = Math.pow(app.sessions.count, 34);
			app.sessions.keyLength += 1;
		}

		//Get unique ID
		while (id === null || app.sessions.usedIds.indexOf(id) != -1) {
			id = random.string(app.sessions.keyLength);
		}

		//Create unique session
		this.ip = ip.toString();
		this.creation = Date.now();
		this.lastActive = Date.now();
		this.id = id;
		app.sessions.usedIds.push(id);

		app.sessions.ids[id] = this;
		this.timerReset();

		return app.sessions.ids[id];
	}

	timerReset() {
		this.lastActive = Date.now();

		if (this.timer) {
			//Delete old timer
			clearTimeout(this.timer);
		}

		this.timer = setTimeout(function (self) {
			self.delete();
		}, this.appRef.sessionExpiry, this);
	}

	delete() {
		this.appRef.deleteSession(this.id);
		app.sessions.count -= 1;
	}
}

class App {
	constructor() {
		this.bindings = [];
		this.ports = [];


		this.sessions = {
			ids: {},
			keyLength: 20,
			keyPossibilities: Math.pow(34, 20),
			count: 0,
			usedIds: []
		};
		this.noSession = false;
		this.sessionExpiry = 1000 * 60 * 60 * 3; //3h

		this.authenticators = [];
	}

	/**
	* Bind http request via url + method
	* @param {string} get, post, put, ect
	* @param {string} url of the bind to be triggered
	* @param {callback} function to be called when the bind it triggered
	* @param {any}
	* @param {void}
	*/
	bind(method, path, callback, requirements) {
		if (!(requirements instanceof Object)) {
			requirements = {};
		}

		this.bindings.push([method, path, callback, requirements]);
		return this.bindings[this.bindings.length - 1];
	}

	/**
	* Bind the callback to a get request
	* @param {string} the trigger path
	* @param {function} the function to execute when path is requested
	* @return {void}
	*/
	get(path, callback, requirements) {
		path = path.toLowerCase();
		return this.bind('get', path, callback, requirements);
	}

	/**
	 * Bind the callback to a post request
	 * @param {string} the trigger path
	 * @param {function} the function to execute when the path is requested
	 * @param {any} requerments
	 * @return {void}
	*/
	post(path, callback, requirements = {form: true}) {
		if (!(requirements instanceof Object)) {
			requirements = {};
		}
		if (requirements.form === undefined) {
			requirements.form = true;
		}

		return this.bind('post', path, callback, requirements);
	}

	/**
	 * Bind the callback to a put request
	 * @param {string} the trigger path
	 * @param {function} the function to execute when the path is requested
	 * @param {any} requirements
	 * @return {void}
	 */
	put(path, callback, requirements = {form: true}) {
		if (!(requirements instanceof Object)) {
			requirements = {};
		}
		if (requirements.form === undefined) {
			requirements.form = true;
		}

		return this.bind('put', path, callback, requirements);
	}

	/**
	 * Bind the callback to a delete request
	 * @param {string} the trigger path
	 * @param {function} the function to execute when the path is requested
	 * @param {any} requirements
	 * @return {void}
	 */
	delete(path, callback, requirements) {
		return this.bind('delete', path, callback, requirements);
	}

	/**
	 * Bind the callback to a patch request
	 * @param {string} the trigger path
	 * @param {function} the function to execute when the path is requested
	 * @param {any} requirements
	 * @return {void}
	 */
	patch(path, callback, requirements = {form: true}) {
		if (!(requirements instanceof Object)) {
			requirements = {};
		}
		if (requirements.form === undefined) {
			requirements.form = true;
		}

		return this.bind('patch', path, callback, requirements);
	}

	/**
	 * Add a prerequisit for the request to follow though
	 * @param {array:string} trigger paths
	 * @param {function} validityTestor
	 * @param {function} denied
	 * @param {string} ignore
	 * @return {void}
	 */
	addAuth(paths, validityTestor, denied, ignore) {
		if (paths.length > 0 && typeof (validityTestor) == "function" && typeof (denied) == "function") {
			this.authenticators.push({ paths: paths, validity: validityTestor, ignore: ignore, denied: denied });
		} else {
			//Error
			if (!paths || paths.length <= 0) {
				console.error("**ERROR: invalid auth path");
			}
			if (typeof (validityTestor) != "function") {
				console.error("**ERROR: invalid auth validityTestor");
			}
			if (typeof (denied) != "function") {
				console.error("**ERROR: invalid auth denied");
			}
			return;
		}
	}

	IsValidSession(req, res) {
		if (this.noSession) {
			return true;
		}

		var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress || req.connection.socket.remoteAddress;

		if (req.sessionChecked) {
			req.sessionChecked = true;
			return req.session !== null;
		}

		if (typeof(req.cookies.session)) {
			if (this.sessions.ids[req.cookies.session] instanceof UserSession /*&& ip === this.sessions.ids[req.cookies.session].ip*/) {
				req.session = this.sessions.ids[req.cookies.session];
				req.session.timerReset();
				req.validSession = true;

				req.sessionChecked = true;

				return true;
			}
		}

		var sid = new UserSession(ip, this, req.cookies.session).id;
		res.setHeader('Set-Cookie', 'session=' + sid + ';path=/');
		req.cookies.session = sid;
		req.session = this.sessions.ids[sid];

		req.sessionChecked = true;
	}
	IsAuthorized(req, res) {
		for (let rule of this.authenticators) {
			for (let ignorePath of rule.ignore) {
				if (PathTester(ignorePath, req.url)) {
					return true;
				}
			}

			for (let restricted of rule.paths) {
				if (PathTester(restricted, req.url)) {
					if (!rule.validity(req)) {
						rule.denied(req, res);
						return false;
					}
				}
			}
		}

		return true;
	}
	deleteSession(id) {
		var index = this.sessions.usedIds.indexOf(id);
		this.sessions.usedIds.splice(index, 1);
		this.sessions.ids[id] = undefined;
	}

	parseFile(req, res, file, includeHeader) {				
		if (fs.existsSync(file)) {
			if (this.headerFile && includeHeader && req.extention === 'html' && !req.query.noHeader) {
				res.setHeader('Content-Type', 'text/html');

				res.end(
					MergHTML(
						fs.readFileSync(this.headerFile).toString(),
						fs.readFileSync(file).toString()
					)
				);
			} else {
				res.setHeader('Chuncked', 'true');
				let mimeType = mime.lookup(req.extention);
				if (mimeType) {
					res.setHeader('Content-Type', mimeType);
				}

				fs.stat(file, function (error, stats) {
					var start;
					var end;

					if (req.headers.range) {
						var total = stats.size || 0;
						var range = req.headers.range;
						var parts = range.replace(/bytes=/, "").split("-");

						start = parseInt(parts[0], 10);
						end = parts[1] ? parseInt(parts[1], 10) : total - 1;
						var chunksize = (end - start) + 1;

						if (start > end) {
							var c = start;
							start = end;
							end = c;
						}

						res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
						res.setHeader('Accept-Ranges', 'bytes');
						res.setHeader('Content-Length', chunksize);
					} else {
						res.setHeader('Content-Length', stats.size || 0);
					}

					var stream = fs.createReadStream(file, { start: start, end: end });
					stream.pipe(res);
					req.on('end', stream.close);
					req.on('close', stream.close);
					req.on('error', stream.close);
				});
			}
		}else{
			return false;
		}

		return true;
	}
	request(req, res) {
		var anchorIndex;
		var queryIndex;
		var index;
		var value;
		var parts;
		var page;
		var name;





    /*--------------------------------------------------------------
        Get Cookies
		--------------------------------------------------------------*/
		req.cookies = {};
		if (req.headers && req.headers.cookie) {
			parts = req.headers.cookie.split(';');
			for (let item of parts) {
				var sections = item.split('=');
				if (sections.length < 1) {
					continue;
				}
				name = sections[0];
				while (name[0] == " ") {
					name = name.slice(1);
				}
				sections = sections.splice(1);
				if (sections.length < 1) {
					sections = [true];
				}
				req.cookies[name] = sections.join('=');
			}
		}





    /*--------------------------------------------------------------
        Get Querys
    --------------------------------------------------------------*/
		queryIndex = req.url.indexOf('?');
		if (index === -1) {
			req.queryString = '';
		} else {
			req.queryString = req.url.substr(queryIndex+1);
		}

		req.query = query.parse(req.queryString);




    /*--------------------------------------------------------------
        Get Raw Path
    --------------------------------------------------------------*/
		if (queryIndex != -1) {
			req.path = req.url.slice(0, queryIndex);
		} else {
			req.path = req.url;
		}
		req.path = decodeURIComponent(req.path);





    /*--------------------------------------------------------------
        Get extention
    --------------------------------------------------------------*/
		page = req.path == '/' ? '/index' : req.path;
		page = page.split('.');

		if (page.length > 1) {
			req.extention = page.splice(-1, 1)[0] || null;
		} else {
			req.extention = null;
		}
		page = page.join('.');





    /*--------------------------------------------------------------
        Get Session
    --------------------------------------------------------------*/
		this.IsValidSession(req, res);






    /*--------------------------------------------------------------
        Get Authorization
    --------------------------------------------------------------*/
		if (!this.IsAuthorized(req, res)) {
			return false;
		}



		

    /*--------------------------------------------------------------
        Run URL Handles
    --------------------------------------------------------------*/
		var method = req.method.toLowerCase();

		//bind = [method, path, callback, requirements]
		for (let bind of this.bindings) {
			req.wildcards = PathTester(bind[1], req.path);
			if (bind[0] === method && req.wildcards) {
				
				if (bind[3].form) {
					ps(req, res);
				}

				bind[2](req, res);
				return true;
			}
		}

		if (this.publicFolder && this.parseFile(req, res, this.publicFolder + page + '.' + (req.extention || 'html'), true)) {
			return true;
		}

		this.on404(req, res);
		return false;
	}
	on404(req, res) {		
		//Error 404
		res.statusCode = 404;
		res.end("Cannot find " + req.url);
	}


	/**
	 *
	 * @param {int} port
	 * @param {any} if object, then a https server will try and start with the options provided
	 * @return {object} Server instance
	 */
	listen(port, opts) {
		var appRef = this;
		var id = this.ports.length;

		if (opts){
			this.ports[id] = https.createServer(opts, function(){
				appRef.request.apply(appRef, arguments);
			});
			this.ports[id].listen(port, function(){
				console.info('HTTPS Listening', port);
			});
		}else{
			this.ports[id] = http.Server(function(){
				appRef.request.apply(appRef, arguments);
			});
			this.ports[id].listen(port, function () {
				console.info('Listening', port);
			});
		}

		return this.ports[id];
	}
}


/**
 * Test if two strings are equal while path may have wildchard characters
 * @param {string} path
 * @param {string} location
 */
function PathTester(path, location){
	path = path.toLowerCase();
	location = location.toLowerCase();

	if (path.indexOf('*') === -1){
		return path === location;
	}else{
		var wildStart = 0;
		var index = 0;
		var wild = false;
		var out = [];

		for (var i=0; i<location.length; i++){
			if (path[index] === '*'){
				wild = true;
				wildStart = i;
				index += 1;
				i--;
				continue;
			}

			if (path[index] === location[i]){
				if (wild){
					out.push(location.substr(wildStart, i-wildStart));
				}
				
				wild = false;
				index += 1;
			}else if (!wild){
				return null;
			}
		}
		
		if (wild){
			out.push(location.substr(wildStart, i-wildStart));
		}

		if (path[index] === '*'){
			index += 1;
		}

		if (index == path.length){
			return out;
		}else{
			return null;
		}
	}
}


function MergHTML(header, other) {
	var merg = '';

	var headerOpen = other.indexOf('<head>') + 6;
	var headerClose = other.indexOf('</head>');
	if (headerOpen == -1 || headerClose == -1) { return other; }
	var otherHead = other.slice(headerOpen, headerClose);

	headerClose = header.indexOf('</head>');
	if (headerClose == -1) { return other; }
	merg += header.slice(0, headerClose) + otherHead + '</head><body';



	var bodyOpen = other.indexOf('<body') + 5;
	var bodyOpenEnd = other.slice(bodyOpen).indexOf('>') + 1;
	var bodyTage = other.slice(bodyOpen, bodyOpen + bodyOpenEnd);
	var otherBody = other.slice(bodyOpen + bodyOpenEnd, other.indexOf('</body>'));
	merg += bodyTage;

	bodyOpen = header.indexOf('<body') + 5;
	bodyOpen += header.slice(bodyOpen).indexOf('>') + 1;
	merg += header.slice(bodyOpen, header.indexOf('</body>'));

	merg += otherBody + '</body>\n</html>';

	return merg;
}


module.exports = new App();
module.exports.app = App;
