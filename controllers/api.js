'use strict';

var config = require('../config');
var _ = require('lodash');

function Api(app) {
  this.app = app;

  if (app.get('environment') === 'heroku') {
    this.apiKey = process.env.API_KEY;
  } else {
    this.apiKey = config.app.apiKey;
  }
  _.bindAll(this, 'syncData');
}

module.exports = Api;

Api.prototype.register = function() {
  this.app.post('/api/sync', this.syncData);
};

Api.prototype.syncData = function syncData(req, res, next) {

  var key = req.headers['x-api-key'];

  if (!key || key !== this.apiKey) {
    return res.status(403).send();
  }

  console.log('Syncing data from Google doc');

  return this.app.services.googledocs.refreshLocalData()
    .then(function() {
      console.log('done');
      res.send();
    })
    .catch(next);

};