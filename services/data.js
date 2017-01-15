(function() {
  var Converter, Data, Reference, Shooting, archiver, callbacks, ld, logger, moment, mongoose, node, nodefn, parallel, redis, redisTTL, request, w, webCapture,
    bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  w = require('when');

  node = require('when/node');

  callbacks = require('when/callbacks');

  mongoose = require('mongoose');

  mongoose.Promise = require('bluebird');

  Shooting = require('.././data/schema/shooting');

  Reference = require('.././data/schema/reference');

  redis = require('redis');

  moment = require('moment-timezone');

  parallel = require('when/parallel');

  redisTTL = 1 * 60 * 60;

  nodefn = require('when/node');

  request = require('request');

  Converter = require('csvtojson').Converter;

  ld = require('lodash');

  webCapture = null;

  archiver = null;

  logger = null;

  Data = (function() {
    function Data(config, logger1) {
      var ref1, userpass;
      this.logger = logger1;
      this.pullSheetData = bind(this.pullSheetData, this);
      this.processArchives = bind(this.processArchives, this);
      this.csvToJSON = bind(this.csvToJSON, this);
      this.updateFromCSV = bind(this.updateFromCSV, this);
      this.getTotals = bind(this.getTotals, this);
      this.getByYear = bind(this.getByYear, this);
      this.getRedisKeys = bind(this.getRedisKeys, this);
      this.deleteRedisKey = bind(this.deleteRedisKey, this);
      this.connectToMongo = bind(this.connectToMongo, this);
      this.getRedisConn = bind(this.getRedisConn, this);
      if (config == null) {
        throw 'config is required!';
      }
      webCapture = new (require('./webCapture'))(null, this.logger);
      archiver = new (require('./archive_is'))(this.logger);
      this.config = config;
      this.csvUrls = config.googleDocs;
      userpass = '';
      if (config.mongo.user != null) {
        if (config.mongo.password == null) {
          throw 'no password, password is required if user is set';
        }
        userpass = config.mongo.user + ":" + config.mongo.password + "@";
      }
      if (userpass) {
        this.mongoURL = "mongodb://" + userpass + config.mongo.url;
      } else {
        this.mongoURL = config.mongo.url;
      }
      if (this.logger == null) {
        this.logger = (require('bunyan'))({
          name: 'mst-data',
          level: (((ref1 = config.logging) != null ? ref1.level : void 0) != null) || 10
        });
      }
      logger = this.logger;
      mongoose.connect(this.mongoURL);
      mongoose.connection.on('error', function(args) {
        logger.error("Mongo connection error!");
        logger.error(args);
        throw new Error("Mongo connection failed, throw error for restart");
      });
      mongoose.connection.once('open', (function(_this) {
        return function() {
          _this.logger.info('Mongo connection open');
          return _this.logger.debug({
            args: arguments
          });
        };
      })(this));
      process.on('unhandledRejection', (function(_this) {
        return function(reason, p) {
          return _this.logger.error('Possibly Unhandled Rejection at: Promise ', p, ' reason: ', reason);
        };
      })(this));
    }

    Data.prototype.getRedisConn = function() {
      var promise;
      promise = w.promise((function(_this) {
        return function(resolve, reject) {
          var redisClient;
          if (_this.redisClient != null) {
            return resolve(_this.redisClient);
          } else {
            redisClient = redis.createClient({
              port: _this.config.redis.port,
              host: _this.config.redis.host,
              auth_pass: _this.config.redis.auth_pass
            });
            redisClient.on('connect', function() {
              _this.redisClient = redisClient;
              return resolve(redisClient);
            });
            return redisClient.on('error', function(err) {
              _this.logger.error('Redis error ' + err);
              return reject(err);
            });
          }
        };
      })(this));
      return promise;
    };

    Data.prototype.connectToMongo = function() {
      var promise;
      logger = this.logger;
      promise = w.promise((function(_this) {
        return function(resolve, reject) {
          logger.trace("ready state: " + mongoose.connection.readyState);
          if (mongoose.Connection.STATES.connected === mongoose.connection.readyState) {
            return resolve(true);
          } else {
            return logger.error("Mongoose connection expired?");
          }
        };
      })(this));
      return promise;
    };

    Data.prototype.deleteRedisKey = function(key) {
      var getConn, promise;
      getConn = this.getRedisConn;
      this.logger.debug("deleting redis key '" + key + "'");
      promise = w.promise(function(resolve, reject) {
        return getConn()["catch"](function(err) {
          return reject(err);
        }).then(function(redisClient) {
          return redisClient.del(key, function(err) {
            if (err != null) {
              return reject(err);
            } else {
              return resolve(true);
            }
          });
        });
      });
      return promise;
    };

    Data.prototype.getRedisKeys = function() {
      var promise;
      promise = w.promise((function(_this) {
        return function(resolve, reject) {
          _this.logger.debug("getting all redis keys");
          return _this.getRedisConn().then(function(redisClient) {
            return redisClient.keys('*', function(err, keys) {
              if (err != null) {
                reject(err);
              }
              return resolve(keys);
            });
          });
        };
      })(this));
      return promise;
    };

    Data.prototype.getByYear = function(year) {
      var getMongoConn, promise, redisURL;
      if (year == null) {
        year = 'all';
      }
      this.logger.debug("getting by year for " + year);
      logger = this.logger;
      redisURL = this.redisURL;
      getMongoConn = this.connectToMongo;
      promise = w.promise((function(_this) {
        return function(resolve, reject) {
          logger.trace('connecting to redis');
          return _this.getRedisConn()["catch"](function(err) {
            return reject(err);
          }).then(function(redisClient) {
            return redisClient.get(year, function(err, reply) {
              if (err != null) {
                logger.error(err);
                return reject(err);
              } else {
                reply = JSON.parse(reply);
                if ((reply != null) && (reply.length != null) && reply.length > 0) {

                  /* found in redis, return that */
                  logger.debug("key " + year + " found in redis, returning");
                  return resolve(reply);
                } else {
                  logger.trace('not found in redis');

                  /* redis returned an empty set, get from mongo */
                  return getMongoConn()["catch"](function(err) {
                    return reject(err);
                  }).then(function(dbconn) {
                    var begin, end;
                    logger.trace("pulling by year from mongo for " + year);
                    if (year !== 'all') {
                      begin = moment(year + " Jan 01", 'YYYY mmm DD').year();
                      end = moment((+year + 1) + " Jan 01", 'YYYY mmm DD').year();
                    } else {
                      begin = moment().subtract(20, 'years').year();
                      end = moment().add(1, 'years').year();
                    }
                    logger.trace({
                      begin: begin,
                      end: end
                    });

                    /* TODO: this can be cleaned up a bit since year is now a property of the entry */
                    return Shooting.$where("this.year >= " + begin + " && this.year < " + end).sort('-date').exec(function(err, shootings) {
                      logger.debug('# shootings', (shootings != null ? shootings.length : void 0) || 0);
                      if (err != null) {
                        return reject(err);
                      } else {
                        logger.trace("got shootings for year; storing in redis");
                        logger.trace("modifying displayed year");

                        /* store in redis with a one day TTL */
                        redisClient.set(year, JSON.stringify(shootings));
                        redisClient.expire(year, redisTTL);
                        return resolve(shootings);
                      }
                    });
                  });
                }
              }
            });
          });
        };
      })(this));
      return promise;
    };


    /*
      return value:
      { '2014': 24, '2015': 279, totalAllYears: 303, daysSince: 2 }
     */

    Data.prototype.getTotals = function() {
      var promise;
      promise = w.promise((function(_this) {
        return function(resolve, reject) {
          var getMongoConn, key, startYear;
          logger = _this.logger;
          logger.debug('connecting to redis');
          key = 'totals';
          startYear = 2013;
          getMongoConn = _this.connectToMongo;
          return _this.getRedisConn()["catch"](function(err) {
            return reject(err);
          }).then(function(redisClient) {
            return redisClient.get(key, function(err, reply) {
              var replyAsObj;
              if (err != null) {
                logger.error(err);
                return reject(err);
              } else {
                if ((reply != null) && (reply !== "[]")) {

                  /* found in redis, return that */
                  replyAsObj = JSON.parse(reply);
                  logger.debug('totals found in redis, returning');
                  return resolve(replyAsObj);
                } else {
                  logger.debug("didn't find totals in redis; pulling fresh");

                  /* redis returned an empty set, get from mongo */
                  return getMongoConn()["catch"](function(err) {
                    return reject(err);
                  }).then(function(dbconn) {
                    var result;
                    result = {};
                    return Shooting.count().exec(function(err, count) {
                      var now;
                      if (err != null) {
                        reject(err);
                        return;
                      }
                      result.totalAllYears = count;
                      now = moment();
                      return Shooting.find(null, null, {
                        limit: 1
                      }).sort('-date').exec(function(err, docs) {
                        var duration, lastDate;
                        if (err != null) {
                          reject(err);
                          return;
                        }
                        if (docs.length === 0) {
                          resolve(null);
                          return;
                        }
                        lastDate = docs[0].date;
                        duration = Math.floor(Math.abs(moment.duration(now.diff(lastDate)).asDays()));
                        result.daysSince = duration;
                        return Shooting.find(null, null, {
                          limit: 5
                        }).sort('-date').exec(function(err, mostRecent) {
                          var currentYear, j, ref1, ref2, results, year, years;
                          logger.debug('got 5 most recent shootings');
                          result.mostRecent = mostRecent;
                          currentYear = new Date().getFullYear();
                          years = [];
                          results = [];
                          for (year = j = ref1 = startYear, ref2 = currentYear; ref1 <= ref2 ? j <= ref2 : j >= ref2; year = ref1 <= ref2 ? ++j : --j) {
                            years.push(year);
                            results.push((function(year) {
                              return Shooting.count({
                                year: year
                              }).exec(function(err, count) {
                                var daysThisYear, k, len1, n;
                                if (err != null) {
                                  reject(err);
                                } else {
                                  result[year] = count;
                                  n = 0;
                                  for (k = 0, len1 = years.length; k < len1; k++) {
                                    year = years[k];
                                    if (result[year] != null) {
                                      n++;
                                    }
                                  }
                                  if (n === years.length) {
                                    logger.debug('setting totals into redis');
                                    daysThisYear = Math.floor(Math.abs(moment.duration(moment().diff(new Date(year, 1, 1))).asDays()));
                                    result.average = ld.floor(result[year] / daysThisYear, 2);
                                    redisClient.set(key, JSON.stringify(result));
                                    redisClient.expire(key, redisTTL);
                                    return resolve(result);
                                  }
                                }
                              });
                            })(year));
                          }
                          return results;
                        });
                      });
                    });
                  });
                }
              }
            });
          });
        };
      })(this));
      return promise;
    };

    Data.prototype.updateFromCSV = function(input) {
      var data, deleteRedisKey, promise, year, yearsInCSV;
      logger = this.logger;
      logger.debug("starting update from csv");
      yearsInCSV = [];
      data = input.data, year = input.year;
      if (data != null ? data[0] : void 0) {
        logger.debug("data sample: ", data[0]);
      }
      if ((!data) || data.length === 0) {
        logger.trace("update from csv has no records in input, returning");
        return 0;
      }
      deleteRedisKey = this.deleteRedisKey;
      promise = w.promise((function(_this) {
        return function(resolve, reject) {
          if (!((data != null) && (year != null))) {

            /* TODO: ridiculous hack, I don't know why updateFromCSV is being called twice - MC 9Dec2015 */
            logger.trace("hit the hack path in updateFromCSV :( oh well just keep going :/");
            return resolve(0);
          }
          return _this.connectToMongo().then(function() {
            return Shooting.find({
              year: +year
            }).remove();
          }).then(logger.info("removed all records for year:" + year)).then(function(conn) {
            var checked, d, e, entry, i, j, len, len1, n, ref, ref1, results, total;
            try {
              logger.debug('connected to mongo; pushing new values into db');
              ref = data;
              total = data.length;
              checked = 0;
              n = 0;
              i = 0;
              len = ref.length;
              if (len === 0) {
                logger.warn("no values found, returning");
                resolve(0);
              }
              results = [];
              while (i < len) {

                /*
                sample:
                { date: '9/20/2015',
                 name: 'Unknown',
                 killed: 0,
                 wounded: 6,
                 city: 'Tulsa',
                 state: 'OK',
                 synopsis: '',
                 guns_info: '',
                 other_info: '',
                 sources_semicolon_delimited: 'http://www.newson6.com/story/30072412/six-shot-outside-tulsa-nightclub' },
                 */
                d = ref[i];
                entry = new Shooting;
                if (d.date == null) {
                  logger.error("row #" + (i + 1) + " is missing a date entry. skipping");
                  i++;
                  continue;
                }
                entry.date = moment.tz(d.date, 'MM/DD/YYYY', "America/Los_Angeles").format();
                entry.year = +entry.date.getFullYear();
                entry.killed = d.killed;
                entry.city = d.city;
                entry.wounded = d.wounded;
                entry.city = d.city;
                entry.state = d.state;
                if (d.sources_semicolon_delimited.indexOf(';') > -1) {
                  entry.sources = ld.filter(d.sources_semicolon_delimited.split(';'), function(x) {
                    return !!x.length;
                  });
                } else {
                  entry.sources = d.sources_semicolon_delimited;
                }
                if (d.name_semicolon_delimited.indexOf(';') > -1) {
                  d.name_semicolon_delimited.split(';').forEach(function(p) {
                    return entry.perpetrators.push({
                      name: p
                    });
                  });
                } else {
                  entry.perpetrators = [
                    {
                      name: d.name_semicolon_delimited
                    }
                  ];
                }
                logger.trace({
                  "entry": entry
                });
                yearsInCSV.push(entry.date.getFullYear());

                /*
                 find any entries on this data with the same city and state and at least one matching source
                 if found, delete and re-create
                 else just save each one
                 */
                entry.save();
                ++checked;
                if (checked === total) {
                  logger.info("done writing data to Mongo: " + checked + " records");
                  logger.info('deleting redis keys');
                  ref1 = ld.uniq(yearsInCSV);
                  for (j = 0, len1 = ref1.length; j < len1; j++) {
                    year = ref1[j];
                    deleteRedisKey('' + year);
                  }
                  deleteRedisKey('totals');
                  deleteRedisKey('all');
                  logger.info('deleted redis keys');
                  resolve(checked);
                }
                results.push(i++);
              }
              return results;
            } catch (error) {
              e = error;
              return reject(e);
            }
          })["catch"](function(err) {
            return reject(err);
          });
        };
      })(this));
      return promise;
    };

    Data.prototype.getSheet = function(url) {
      if (!((url != null) && !!url)) {
        throw 'getSheet did not receive a valid url';
      }
      return nodefn.lift(request)({
        uri: url
      }).then(function(result) {
        return w.resolve(result[0].body);
      });
    };

    Data.prototype.csvToJSON = function(csvStr) {
      var converter, promise;
      converter = new Converter({});
      logger = this.logger;
      return promise = w.promise(function(resolve, reject) {
        return converter.fromString(csvStr, function(err, result) {
          if (err != null) {
            reject(err);
          }
          logger.debug("Got records from CSV, count: ", result.length);
          return resolve(result);
        });
      });
    };

    Data.prototype.processArchives = function(cb) {
      var promise;
      promise = w.promise((function(_this) {
        return function(resolve, reject) {
          var e;
          logger.info('Finding unarchived documents');
          try {
            return Reference.find({
              $or: [
                {
                  screenshotPath: {
                    $eq: null
                  }
                }, {
                  screenshotPath: {
                    $exists: false
                  }
                }
              ]
            }).limit(20).exec(function(err, docs) {
              var c, checkExit, checkUrl, d, delay, delayInc, doc, e, j, len1, results;
              c = docs.length;
              if (c === 0) {
                resolve("No update needed.");
              }
              if (err != null) {
                reject(err);
              }

              /*
              edit: mostlycarbonite, Jan 2017: damn this code could really benefit from
              some Promise.map and concurrency limits; but it works as is :/
               */
              d = 0;
              e = 0;
              delayInc = 2000;
              delay = 10000;
              logger.debug("checking archive for " + c + " entries");
              checkExit = function() {
                var message;
                if (d === c) {
                  if (e >= c) {
                    message = "All urls failed. See logs.";
                    reject(message);
                  } else if (e > 0) {
                    message = "Some urls encountered an error, check logs.";
                  } else if (d >= c) {
                    message = "OK";
                  }
                  logger.info("Exiting processArchives, " + d + " done, " + e + " errors.", message);
                  return resolve(message);
                }
              };
              checkUrl = function(url, doc) {
                logger.debug("checking archive for url: " + url);

                /*
                next block is ignored for now, archiver.is and cloudflare are causing problems
                 */
                try {
                  if (false) {
                    archiver.check(url, function(err, result) {
                      if (err != null) {
                        ++e;
                        return logger.error(err);
                      } else if (result != null ? result.found : void 0) {
                        logger.debug("archive url for " + url + ": " + result.url + "; saving");
                        doc.archiveUrl = result.url;
                        return doc.save();
                      } else if (!(result != null ? result.found : void 0)) {
                        return archiver.save(url);
                      } else {
                        logger.error("result.url was empty");
                        return reject("archiver check failed");
                      }
                    });
                  }
                  if (!doc.screenshotPath) {
                    logger.debug("capture screenshot for url: " + url);
                    webCapture.capture(url, function(err, path) {
                      if (err != null) {
                        ++e;
                        logger.error("capture failed for url: " + url);
                        logger.error("document:");
                        logger.error({
                          document: doc.model
                        });
                        logger.error({
                          error: err
                        });
                        return doc.error = err;
                      } else {
                        if (doc.error != null) {
                          delete doc.error;
                        }
                        doc.screenshotPath = path;
                        return doc.save();
                      }
                    });
                  } else {
                    doc.save();
                  }
                } catch (error) {
                  err = error;
                  logger.error(err);
                }
                ++d;
                return checkExit();
              };
              results = [];
              for (j = 0, len1 = docs.length; j < len1; j++) {
                doc = docs[j];
                results.push((function(url, doc) {
                  setTimeout((function() {
                    return checkUrl(url, doc);
                  }), delay);
                  return delay += delayInc;
                })(doc.url, doc));
              }
              return results;
            });
          } catch (error) {
            e = error;
            logger.error({
              error: e
            });
            return reject(e);
          }
        };
      })(this));
      return promise;
    };

    Data.prototype.pullSheetData = function(year) {
      var promise;
      logger = this.logger;
      this.timeout = 5000;
      return promise = w.promise((function(_this) {
        return function(resolve, reject) {
          var csvUrl;
          csvUrl = _this.csvUrls[year];
          if (csvUrl == null) {
            logger.error("couldn't find CSV url for year: " + year);
            reject("Failed. See logs.");
          }
          logger.debug(("pulling data for year: " + year + " from  ") + csvUrl);
          return _this.connectToMongo().then(function() {
            return _this.getSheet(csvUrl);
          }).then(function(sheetStr) {
            return _this.csvToJSON(sheetStr);
          }).then(function(csvJSONresults) {
            promise = w.promise(function(resolve, reject) {

              /*
                when new sources come in we store them but don't request that they be archived
                this is so that we don't swamp archive.is
                there will be a cron job that runs every 30 minutes and archives a few links at a time
               */
              var c, d, j, json, k, l, len1, len2, len3, ref1, results, source, url, urls;
              urls = [];
              for (j = 0, len1 = csvJSONresults.length; j < len1; j++) {
                json = csvJSONresults[j];
                ref1 = json.sources_semicolon_delimited.split(';');
                for (k = 0, len2 = ref1.length; k < len2; k++) {
                  source = ref1[k];
                  urls.push(source);
                }
              }
              logger.debug("adding Reference records");
              c = urls.length;
              d = 0;
              if (c === 0) {
                logger.warn("no records found, skipping");
                resolve(csvJSONresults);
                return;
              }
              results = [];
              for (l = 0, len3 = urls.length; l < len3; l++) {
                url = urls[l];
                results.push((function(url) {
                  logger.trace("checking url: " + url);
                  return Reference.find({
                    url: url
                  }).exec(function(err, docs) {
                    ++d;
                    if (err != null) {
                      logger.error(err);
                      reject(err);
                    } else if ((docs != null ? docs.length : void 0) === 0) {
                      logger.debug("creating new Reference");
                      new Reference({
                        url: url,
                        archiveUrl: null,
                        capturePath: null
                      }).save();
                    } else {
                      logger.trace("reference exists, skipping");
                    }
                    if (d >= c) {
                      return resolve(csvJSONresults);
                    }
                  });
                })(url));
              }
              return results;
            });
            return promise;
          }).then(function(data) {
            return _this.updateFromCSV({
              data: data,
              year: year
            });
          }).then(function(result) {
            logger.debug("data pull complete: " + result);
            return resolve(result);
          })["catch"](function(err) {
            return reject(err);
          });
        };
      })(this));
    };

    return Data;

  })();

  module.exports.Data = Data;

}).call(this);
