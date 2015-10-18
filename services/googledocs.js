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
var mongoose = require('mongoose');

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
      })

      var daysSinceLastShooting = moment(new Date(result[0].date)).fromNow().split(' ')[0];

      result = _.map(result, function (item) {

        item.location = item.city + ', ' + item.state;

        item.sources = item.sources_csv.split(',');
        item.sources = _.map(item.sources, function (src) {
          return src.trim();
        })

        return item;
      });

      var data = {
        numShootingsThisYear:numShootingsThisYear,
        daysSinceLastShooting:parseInt(daysSinceLastShooting),
        shootings:result
      }

      mongoose.connect(mongoUrl);
      var db = mongoose.connection;
      var Shooting = require('.././data/schema/shooting')
      db.on('error', console.error.bind(console, 'connection error:'));
      db.once('open', function (callback) {
        console.log('connected to mongo; proceeding')
        var d, i, len, ref;

        ref = data.shootings;
        var total = ref.length;
        var checked = 0;
        var n = 0;

        for (i = 0, len = ref.length; i < len; i++) {
          d = ref[i];
          var entry = new Shooting();
          entry.date = new Date(d.date);
          entry.perpetrators = [{name:d.name}];
          entry.killed = d.killed;
          entry.city = d.city;
          entry.wounded = d.wounded;
          entry.city = d.location.split(',')[0];
          entry.state = (d.location.split(',')[1]).trim();
          entry.sources = d.sources;

          // find any entries on this data with the same city and state and at least one matching source
          // if found, delete and re-create
          // else just save each one
          var upsert = function (entry) {

            Shooting.find({
              city:entry.city,
              state:entry.state,
              date:entry.date,
              sources:{$in:entry.sources}
            }).exec(function (err, shooting) {
              // if it exists, delete it
              if (err) throw 'error in Shooting find: ' + err;
              else if (shooting.length > 1) {
                console.dir(entry) // probably needs an IIFE
                throw 'found multiple entries! (this should be very rare at best)'
              }
              else if (shooting.length > 0) {
                Shooting.remove({_id:shooting[0]._id}, function (err, result) {
                  entry.save()
                });
              }
              else {
                ++n;
                entry.save();
              }
              ++checked;
              if (checked == total) {
                console.log("done writing data to Mongo (" + n + " new records)");
                _this._writeJSONToFile(data);
              }
            })
          };

          upsert(entry);

        }
      });
    });
};

GoogleDocs.prototype._writeJSONToFile = function _writeJSONToFile(jsonData) {
  return nodefn.lift(fs.writeFile)('data/shootings.json', JSON.stringify(jsonData));
};