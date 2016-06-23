var conf = {}, def = {};
var ld = require('lodash');

try {
  conf = require('./local.json');
} catch (e) {
  // ignore
  conf = {};
}

def = require('./default.json');
conf = ld.merge(conf, def);

if (process.env.pm_id) {
  console.log("process.env.pm_id : " + process.env.pm_id);
}

if (process.env.OPENSHIFT_NODEJS_IP) {
  conf.app.hostname = process.env.OPENSHIFT_NODEJS_IP;
}
if (process.env.OPENSHIFT_NODEJS_PORT) {
  conf.app.port = process.env.OPENSHIFT_NODEJS_PORT;
}

// set port based on pm2 process ID?
if (false && process.env.pm_id){
  conf.app.port = +conf.app.port + +process.env.pm_id;
}

if (process.env.OPENSHIFT_APIKEY) {
  conf.app.apiKey = process.env.OPENSHIFT_APIKEY;
}
if (process.env.OPENSHIFT_LOG_DIR) {
  conf.app.loggingPath = process.env.OPENSHIFT_LOG_DIR;
}

if (process.env.MONGOLAB_URI) {
  conf.mongo.url = process.env.MONGOLAB_URI;
}
if (process.env.OPENSHIFT_REDISURL) {
  conf.redis.url = process.env.OPENSHIFT_REDISURL;
}
if (process.env.REDISCLOUD_HOSTNAME) {
  conf.redis.host = process.env.REDISCLOUD_HOSTNAME;
}
if (process.env.REDISCLOUD_PASSWORD) {
  conf.redis.auth_pass = process.env.REDISCLOUD_PASSWORD;
}
if (process.env.REDISCLOUD_PORT) {
  conf.redis.port = process.env.REDISCLOUD_PORT;
}
if (process.env.LOG_LEVEL) {
  conf.logLevel = process.env.LOG_LEVEL;
  } else {
  conf.logLevel = "warn"
}

console.log("Log level set to: "+conf.logLevel);

conf.logger = (require('bunyan')).createLogger({
  name:"mst",
  streams:[
    {
      level:conf.logLevel,
      stream:process.stdout
    }, {
      level:"error",
      path:(conf.app.loggingPath + 'mst.log' || "/var/tmp/mst-error.log")
    }
  ]
});

module.exports = conf;
