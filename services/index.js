'use strict';

var GoogleDocs = require('./googledocs');

function Services(app) {
  this.googledocs = new GoogleDocs(app);
  app.services = this;
}

module.exports = Services;