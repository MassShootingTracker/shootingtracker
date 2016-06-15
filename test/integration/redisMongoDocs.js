(function() {
  var Data, chai, expect, ld, path, should, sinon;

  require('source-map-support').install();

  ld = require('lodash');

  chai = require('chai');

  should = chai.should();

  expect = chai.expect;

  sinon = require('sinon');

  path = require('path');

  Data = require('../../services/data.js').Data;

  describe('GoogleDocs / Redis / Mongo', function() {
    var config, errorHandler, getDataLayer;
    before(function(done) {
      return done();
    });
    after(function(done) {
      return done();
    });
    beforeEach(function(done) {
      return done();
    });
    afterEach(function(done) {
      return done();
    });
    config = {};
    errorHandler = function(err) {
      throw err;
    };
    getDataLayer = function() {
      var logger;
      config = require('../../config');
      logger = new (require('bunyan'))({
        name: 'errors',
        level: 50
      });
      return new Data(config, logger);
    };
    it('should get the redis client', function(done) {
      var dl;
      dl = getDataLayer();
      dl.should.be;
      return dl.getRedisConn().then(function(redisClient) {
        redisClient.should.be;
        redisClient.should.have.property('stream');
        return done();
      });
    });
    it('should get keys from the redis client', function(done) {
      var dl;
      dl = getDataLayer();
      dl.should.be;
      return dl.getRedisConn().then(function(redisClient) {
        redisClient.should.be;
        redisClient.should.have.property('stream');
        return redisClient.keys('*', function(err, keys) {
          if (err != null) {
            throw err;
          } else {
            keys.should.be;
            return done();
          }
        });
      });
    });
    it('should delete a redis key', function(done) {
      var dl;
      dl = getDataLayer();
      dl.should.be;
      return dl.deleteRedisKey('2014')["catch"](function(err) {
        throw err;
      }).then(function(result) {
        result.should.be.ok;
        return done();
      });
    });
    it('post install - should get totals for all years', function(done) {
      var dl;
      dl = getDataLayer();
      dl.should.be;
      return dl.getTotals()["catch"](errorHandler).then(function(result) {
        result.should.have.property('2015');
        result.should.have.property('2014');
        result.should.have.property('totalAllYears');
        result.should.have.property('daysSince');
        return done();
      });
    });
    it('post install - should get data for 2015', function(done) {
      var dl;
      dl = getDataLayer();
      dl.should.be;
      return dl.getByYear(2015)["catch"](function(err) {
        throw err;
      }).done(function(shootings) {
        shootings.should.be;
        shootings.length.should.be.gt(200);
        shootings.length.should.be.lt(10000);
        return done();
      });
    });
    return it('should throw when no config', function() {
      var f;
      f = function() {
        return new Data();
      };
      return f.should["throw"](/config is required/);
    });
  });

}).call(this);
