(function() {
  var Converter, Data, Shooting, callbacks, ld, moment, mongoose, node, nodefn, redis, redisTTL, request, w,
    bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  w = require('when');

  node = require('when/node');

  callbacks = require('when/callbacks');

  mongoose = require('mongoose');

  Shooting = require('.././data/schema/shooting');

  redis = require('redis');

  moment = require('moment-timezone');

  redisTTL = 1 * 60 * 60;

  nodefn = require('when/node');

  request = require('request');

  Converter = require('csvtojson').Converter;

  ld = require('lodash');

  Data = (function() {
    function Data(config, logger1) {
      var ref1, userpass;
      this.logger = logger1;
      this.pullSheetData = bind(this.pullSheetData, this);
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
      this.redisPort = config.redis.port;
      this.csvUrls = config.googleDocs;
      userpass = '';
      if (config.mongo.user != null) {
        if (config.mongo.password == null) {
          throw 'no password, password is required if user is set';
        }
        userpass = config.mongo.user + ":" + config.mongo.password + "@";
      }
      this.mongoURL = "mongodb://" + userpass + config.mongo.url;
      if (this.logger == null) {
        this.logger = (require('bunyan'))({
          name: 'mst-data',
          level: (((ref1 = config.logging) != null ? ref1.level : void 0) != null) || 10
        });
      }
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
            redisClient = redis.createClient(_this.redisPort);
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
      var logger, promise;
      logger = this.logger;
      promise = w.promise((function(_this) {
        return function(resolve, reject) {
          if (mongoose.Connection.STATES.connected === mongoose.connection.readyState) {
            return resolve(true);
          } else {
            mongoose.connect(_this.mongoURL);
            mongoose.connection.on('error', function(args) {
              return logger.error(args);
            });
            return mongoose.connection.once('open', function() {
              _this.logger.debug('Mongo connection open');
              _this.logger.debug({
                args: arguments
              });
              return resolve(true);
            });
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
      var getMongoConn, logger, promise, redisURL;
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
                    logger.trace("pulling by year from mongo");
                    begin = moment(year + " Jan 01", 'YYYY mmm DD');
                    end = moment((+year + 1) + " Jan 01", 'YYYY mmm DD');
                    return Shooting.find({
                      date: {
                        $gte: begin,
                        $lt: end
                      }
                    }).sort('-date').exec(function(err, shootings) {
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
          var getMongoConn, key, logger, startYear;
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
                                date: {
                                  $gte: new Date(year, 1, 1),
                                  $lte: new Date(year, 12, 31)
                                }
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

    Data.prototype.updateFromCSV = function(data) {
      var deleteRedisKey, logger, promise, yearsInCSV;
      logger = this.logger;
      logger.trace("starting update from csv");
      yearsInCSV = [];
      deleteRedisKey = this.deleteRedisKey;
      if (data == null) {
        throw "no shootings element found in CSV data";
      }
      promise = w.promise((function(_this) {
        return function(resolve, reject) {
          return _this.connectToMongo().then(function(conn) {
            var checked, d, e, entry, error, i, len, n, ref, total, upsert;
            try {
              logger.debug('connected to mongo; pushing new values into db');
              d = void 0;
              i = void 0;
              len = void 0;
              ref = data;
              total = data.length;
              checked = 0;
              n = 0;
              i = 0;
              len = ref.length;
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
                entry.date = moment.tz(d.date, 'MM/DD/YYYY', "America/Los_Angeles").format();
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
                upsert = function(entry) {
                  return Shooting.find({
                    city: entry.city,
                    state: entry.state,
                    date: entry.date,
                    sources: {
                      $in: entry.sources
                    }
                  }).exec(function(err, shooting) {
                    var j, len1, ref1, year;
                    if (err) {
                      reject(err);
                    } else if (shooting.length > 1) {
                      logger.fatal('found multiple entries! (this should be very rare at best)');
                      logger.fatal({
                        entry: shooting
                      });
                    } else if (shooting.length > 0) {
                      Shooting.remove({
                        _id: shooting[0]._id
                      }, function(err, result) {
                        entry.save();
                      });
                    } else {
                      ++n;
                      entry.save();
                    }
                    ++checked;
                    if (checked === total) {
                      logger.warn('done writing data to Mongo (' + n + ' new records)');
                      logger.info('deleting redis keys');
                      ref1 = ld.uniq(yearsInCSV);
                      for (j = 0, len1 = ref1.length; j < len1; j++) {
                        year = ref1[j];
                        deleteRedisKey('' + year);
                      }
                      deleteRedisKey('totals');
                      logger.warn('deleted redis keys');
                      return resolve(n);
                    }
                  });
                };
                upsert(entry);
                i++;
              }
              return resolve(n);
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
      var converter, logger, promise;
      converter = new Converter({});
      logger = this.logger;
      promise = w.promise(function(resolve, reject) {
        return converter.fromString(csvStr, function(err, result) {
          if (err) {
            reject(err);
          }
          logger.debug({
            "csv records count": result.length
          });
          return resolve(result);
        });
      });
      return promise;
    };

    Data.prototype.pullSheetData = function(year) {
      var promise;
      this.timeout = 5000;
      return promise = w.promise((function(_this) {
        return function(resolve, reject) {
          var csvUrl;
          csvUrl = _this.csvUrls[year];
          _this.logger.debug("pulling data from " + csvUrl);
          return _this.getSheet(csvUrl).then(function(sheetStr) {
            return _this.csvToJSON(sheetStr);
          }).then(_this.updateFromCSV).then(function(result) {
            _this.logger.debug("data pull complete: " + result);
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
