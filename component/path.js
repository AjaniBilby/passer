/**
 * Test if a path matches a given expression
 * "\\" escapes the next character (for; "*", "+")  
 * "*" Wildcard 0-many characters  
 * "+" Wildcard single character  
 * @param {string} expr 
 * @param {string} location 
 */
function Test(expr, location){
  let groups = [];
  let i=0;

  for (let j=0; j<location.length; j++){
    if (expr[i] == '\\'){ //Escaping a character
      i++;
    }else if (expr[i] == '*'){ //Validate wild character
      i++; //Move over the wildcard character

      //If the wildcard is at the end of the expression
      if (i == expr.length){
        groups.push(location.slice(j));
        break;
      }

      let found = false;
      let start = j;
      for (j=j; j<location.length; j++){
        found = location[j] == expr[i];
        if (found){
          groups.push(location.slice(start, j));
          i++;
        }
      }

      if (found){
        continue;
      }

      return false;

    }else if (expr[i] == '+'){ //Skip on character
      groups.push(location[j]);
      continue;
    }

    if (expr[i] != location[j]){
      return false;
    }

    i++;
  }

  return true;
}

/**
 * Get the file extention of a given path
 * @param {string} path 
 */
function Extension(path){
  for (let i=this.length-1; i>=0; i--){
    if (path[i] == '.'){
      return path.slice(i);
    }else if (path[i] == '/' || path[i] == '\\'){
      break;
    }
  }

  return '';
}


module.exports = {
  match: Test,
  extension: Extension
}