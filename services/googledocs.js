'use strict';

var request = require('request');
var when = require('when');
var nodefn = require('when/node');
var config = require('../config');
var fs = require('fs');
var _ = require('lodash');
var moment = require('moment');

var Converter = require('csvtojson').Converter;

function GoogleDocs(app) {
  this.app = app || {};

  if (app.get('environment') === 'dev') {
    this.url = config['google-docs'].url;
  } else {
    this.url = process.env.GOOGLE_DOC_URL;
  }

  _.bindAll(this, 'refreshLocalData', 'getSheet', '_csvToJSON', '_writeJSONToFile');
}

module.exports = GoogleDocs;

GoogleDocs.prototype.getSheet = function getSheet() {

  return nodefn.lift(request)({
    url: this.url
  })
  .then(function(result) {
    return when.resolve(result[0].body);
  });

};

GoogleDocs.prototype._csvToJSON = function _csvToJSON(csvStr) {

  var converter = new Converter({});

  return when.promise(function(resolve, reject) {

    converter.fromString(csvStr, function(err, result){

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
    .then(function(sheetStr) {
      return _this._csvToJSON(sheetStr);
    })
    .then(function(result) {

      var thisYear = String(now.year());

      var numShootingsThisYear = _.filter(result, function(shooting) {
        return shooting.date.indexOf(thisYear) > -1;
      }).length;

      var daysSinceLastShooting = moment(new Date(result[0].date)).fromNow().split(' ')[0];

      result = _.sortBy(result, function(item) {
        return -1 * moment(new Date(item.date)).unix();
      })

      result = _.map(result, function(item) {

        item.location = item.city + ', ' + item.state;

        item.sources = item.sources_csv.split(',');
        item.sources = _.map(item.sources, function(src) {
          return src.trim();
        })

        return item;
      });

      var data = {
        numShootingsThisYear: numShootingsThisYear,
        daysSinceLastShooting: parseInt(daysSinceLastShooting),
        shootings: result
      }

      _this.app.locals.data = data;

      return _this._writeJSONToFile(data);
    });
};

GoogleDocs.prototype._writeJSONToFile = function _writeJSONToFile(jsonData) {
  return nodefn.lift(fs.writeFile)('data/shootings.json', JSON.stringify(jsonData));
};