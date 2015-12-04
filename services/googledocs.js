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

  //throw('this code has moved to /services/data.js');
  this.app = app || {};

  if (app.get('environment') === 'heroku') {
    this.url = process.env.GOOGLE_DOC_URL;
    this.mongoUrl = process.env.MONGO_URL;
  } else {
    this.url = config.googleDocs.url;
    mongoUrl = config.mongo.url;
  }

  _.bindAll(this);
}

module.exports = GoogleDocs;
