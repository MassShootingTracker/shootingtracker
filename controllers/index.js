'use strict';

function Index(app) {
  this.app = app;
}

module.exports = Index;

Index.prototype.register = function() {
  this.app.get('/', this.home);
  this.app.get('/about', this.aboutus);
}

Index.prototype.home = function home(req, res, next) {
  res.render('index');
}

Index.prototype.aboutus = function aboutus(req, res, next) {
  res.render('aboutus');
}