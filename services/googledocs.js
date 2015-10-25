'use strict';

var request = require('request');
var when = require('when');
var nodefn = require('when/node');
var config = require('../config');
var fs = require('fs');
var _ = require('lodash');
var moment = require('moment');
var Converter = require('csvtojson').Converter;
var mongoUrl;

function GoogleDocs(app) {
  this.app = app || {};

  if (app.get('environment') === 'heroku') {
    this.url = process.env.GOOGLE_DOC_URL;
    this.mongoUrl = process.env.MONGO_URL;
  } else {
    this.url = config['google-docs'].url;
    mongoUrl = config['mongo'].url;
  }

  _.bindAll(this, 'refreshLocalData', 'getSheet', '_csvToJSON', '_writeJSONToFile');
}

module.exports = GoogleDocs;

GoogleDocs.prototype.getSheet = function getSheet() {

  return nodefn.lift(request)({
    uri:this.url
  })
    .then(function (result) {
      return when.resolve(result[0].body);
    });

};

GoogleDocs.prototype._csvToJSON = function _csvToJSON(csvStr) {

  var converter = new Converter({});

  return when.promise(function (resolve, reject) {

    converter.fromString(csvStr, function (err, result) {

      if (err) {
        reject(err);
      }

      resolve(result);
    });

  });
};

GoogleDocs.prototype.refreshLocalData = function refreshLocalData() {

  var _this = this;

  var now = moment();

  return this.getSheet()
    .then(function (sheetStr) {
      return _this._csvToJSON(sheetStr);
    })
    .then(function (result) {

      var thisYear = String(now.year());

      var numShootingsThisYear = _.filter(result, function (shooting) {
        return shooting.date.indexOf(thisYear) > -1;
      }).length;

      result = _.sortBy(result, function (item) {
        return -1 * moment(new Date(item.date)).unix();
      });

      var daysSinceLastShooting = moment(new Date(result[0].date)).fromNow().split(' ')[0];

      result = _.map(result, function (item) {

        item.location = item.city + ', ' + item.state;

        item.sources = item.sources_csv.split(',');
        item.sources = _.map(item.sources, function (src) {
          return src.trim();
        });

        return item;
      });

      var data = {
        numShootingsThisYear:numShootingsThisYear,
        daysSinceLastShooting:parseInt(daysSinceLastShooting),
        shootings:result
      }


    });
};

GoogleDocs.prototype._writeJSONToFile = function _writeJSONToFile(jsonData) {
  return nodefn.lift(fs.writeFile)('data/shootings.json', JSON.stringify(jsonData));
};