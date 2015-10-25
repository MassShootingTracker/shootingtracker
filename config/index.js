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

  if (process.env.OPENSHIFT_APPPORT != null) {
    conf.app.port = process.env.OPENSHIFT_APPPORT;
  }
  if (process.env.OPENSHIFT_APIKEY != null) {
    conf.app.apiKey = process.env.OPENSHIFT_APIKEY;
  }
  if (process.env.OPENSHIFT_MONGOURL != null) {
    conf.app.mongo.url = process.env.OPENSHIFT_MONGOURL;
  }
  if (process.env.OPENSHIFT_MONGOPSWD != null) {
    conf.app.mongo.password = process.env.OPENSHIFT_MONGOPSWD;
  }
  if (process.env.OPENSHIFT_MONGOUSER != null) {
    conf.app.mongo.user = process.env.OPENSHIFT_MONGOUSER;
  }
  if (process.env.OPENSHIFT_REDISURL != null) {
    conf.app.redis.url = process.env.OPENSHIFT_REDISURL;
  }
  if (process.env.OPENSHIFT_GOOGLE_DOC_URL != null) {
    conf.app['google-docs'].url = process.env.OPENSHIFT_GOOGLE_DOC_URL;
  }
} catch (e) {
  console.log('File "config/local.json" not found. Falling back to config file "config/default.json"');
  conf = require('./default.json');
}

module.exports = conf;
