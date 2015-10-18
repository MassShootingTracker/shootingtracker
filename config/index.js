var conf;

try {
  conf = require('./local.json');
} catch(e) {
  console.log('File "config/local.json" not found. Falling back to config file "config/default.json"');
  conf = require('./default.json');
}

module.exports = conf;