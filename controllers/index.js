'use strict';

var _ = require('lodash');
var Api = require('./api');

function Index(app) {
  this.app = app;


  _.bindAll(this, 'home');
}

module.exports = Index;

Index.prototype.register = function() {
  this.app.get('/', this.home);
  this.app.get('/about', this.aboutus);
  (new Api(this.app)).register();
}

Index.prototype.home = function home(req, res, next) {
  res.render('index');
}

Index.prototype.aboutus = function aboutus(req, res, next) {
  res.render('aboutus');
}