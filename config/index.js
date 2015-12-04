var conf,def;
var ld = require('lodash');

try {
  try {
    conf = require('./local.json');
  } catch (e) {
    // ignore
  }

  def = require('./default.json');
  conf = ld.merge(conf, def);

  if (process.env.OPENSHIFT_NODEJS_PORT) {
    conf.app.port = process.env.OPENSHIFT_NODEJS_PORT;
  }
  if (process.env.OPENSHIFT_APIKEY) {
    conf.app.apiKey = process.env.OPENSHIFT_APIKEY;
  }
  if (process.env.MONGOLAB_URI) {
    conf.app.mongo.url = process.env.MONGOLAB_URI;
  }
  if (process.env.OPENSHIFT_REDISURL) {
    conf.app.redis.url = process.env.OPENSHIFT_REDISURL;
  }
  if (process.env.OPENSHIFT_LOG_DIR) {
    conf.app.loggingPath = process.env.OPENSHIFT_LOG_DIR;
  }
  if (process.env.REDISCLOUD_HOSTNAME) {
    conf.app.redis.host = process.env.REDISCLOUD_HOSTNAME;
  }
  if (process.env.REDISCLOUD_PASSWORD) {
    conf.app.redis.auth_pass = process.env.REDISCLOUD_PASSWORD;
  }
  if (process.env.REDISCLOUD_PORT) {
    conf.app.redis.port = process.env.REDISCLOUD_PORT;
  }

  conf.logger = (require('bunyan')).createLogger({
    name: "mst",
    streams: [
      {
        level: "debug",
        stream: process.stdout
      }, {
        level: "error",
        path: (conf.app.loggingPath  || "/var/tmp/mst-error.log")
      }
    ]
  });

} catch (e) {
  console.log('File "config/local.json" not found. Falling back to config file "config/default.json"');
  conf = require('./default.json');
}

module.exports = conf;
