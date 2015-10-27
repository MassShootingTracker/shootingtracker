'use strict';

var _ = require('lodash');
var Api = require('./api');
var path = require('path');
var config = require(path.join(process.cwd(),'./config' ))
var dataLayer = null;
var app = null

function Index(appArg) {
  this.app = appArg;
  dataLayer = new (require(path.join(process.cwd(),'./services/data.js' ))).Data(config);
  app = this.app;
  _.bindAll(this, 'home');
}

module.exports = Index;

Index.prototype.register = function() {
  var datapage = this.datapage;
  this.app.get('/', this.home);
  this.app.get('/about', this.aboutus);
  this.app.get('/data', this.datapage);
  this.app.get('/:year(\\d{4})/', function (req, res){
    datapage(req, res);
  });
  (new Api(this.app)).register();
}

Index.prototype.home = function home(req, res, next) {
  dataLayer.getTotals().then(function (data) {
    app.locals.data = data;
    data.currentYear = data[new Date().getFullYear()];
    //console.dir(data);
    res.render('index');
  });
}

Index.prototype.aboutus = function aboutus(req, res, next) {
  res.render('aboutus');
}

Index.prototype.datapage = function datapage(req, res, next) {
  console.log('datapage, param: ' + req.params.year);
  dataLayer.getByYear(+req.params.year).then(function (data) {
    app.locals.data = data;
    //console.dir(data[0])
    res.render('data');
  });
}