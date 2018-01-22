var random = require('mass-random');

/**
 * @returns {number} the index of the first empty array element
 */
Array.prototype.firstEmpty = function(){
  for (let i=0; i<this.length; i++){
    if (this[i] === null || this[i] === undefined){
      return i;
    }
  }

  return this.length;
}





class Session{
  constructor(owner, index, id, ip){
    if (!(owner instanceof Treasury)){
      throw "Failed to create a new session, due to invalid treasury owner";
    }

    this.lastActive = Date.now();
    this.index = index;
    this.owner = owner;
    this.data = {};
    this.id = id;
    this.ip = ip;
  }
}
/**
 * Check if the input matches this session
 * @param {string} id 
 * @param {string} ip 
 */
Session.prototype.match = function(id, ip){
  return this.id == id && this.ip == ip;
}
/**
 * Reset the expiry for this session
 */
Session.prototype.resetExpiry = function(){
  this.lastActive = Date.now;

  if (this.timer){
    clearTimeout(this.timer);
  }

  this.timer = setTimeout((self)=>{
    self.delete();
  }, this.owner.sessionExpiry, this);
}
Session.prototype.delete = function(){
  //Remove one from the count if it is in the current set
  if (this.id.length == this.owner.keyLength){
    this.owner.count -= 1;
  }

  //Helping out garbage collection
  delete this.owner.sessions[this.index]; //Make the index empty for a new index to fill
  delete this;
  return;
}






class Treasury{
  constructor(){
    this.keyLength = 20,
    this.numKeys = Math.pow(34, (this.keyLength-1)); //Leave some blank for security purposes as well as speed increases
    this.sessions = [];
    this.sessionExpiry = 1000 * 60 * 60 * 3; //3H

    this.count = 0; //The number of sessions at the current session length
                    //Because if you increase the session key length none of them will conflict with the previouse set
  }
}
/**
 * Find a session that matches the input
 * @param {string} id 
 * @param {string} ip 
 */
Treasury.prototype.find = function(id, ip){
  for (let session of this.sessions){
    if (session.match(id, ip)){
      return session;
    }
  }
  return null;
}
/**
 * Create a new unique session
 * @param {string} ip 
 */
Treasury.prototype.create = function(ip){
  let id = '';
  let exist = true;

  //Generate a new unique session
  while (exist == true){
    id = random.string(this.keyLength);
    exist = false;

    for (let session of this.sessions){
      if (session.id == id){
        exist = true;
        break;
      }
    }
  }

  //Add session to memory
  let index = this.sessions.firstEmpty();
  this.sessions[index] = new Session(this, index, id, ip);
  this.count += 1;

  //Update the key length if there is allot of sessions
  this.updateKey();

  return this.sessions[index];
}
/**
 * Update the key length if necesary to ensure that there are no conflicts
 */
Treasury.prototype.updateKey = function(){
  if (this.count >= this.numKeys){
    this.keyLength += 1;
    this.keyLength = Math.pow(34, (this.keyLength-1));
    this.count = 0;
  }
}
/**
 * Find the session if it already exists, otherwise make one
 * @param {string} id 
 * @param {string} ip 
 */
Treasury.prototype.define = function(id, ip){
  let session = id ? this.find(id, ip) : null; //if the id is invalid don't check it
  if (session instanceof Session){
    return session;
  }

  return this.create(ip);
}


module.exports = Treasury;