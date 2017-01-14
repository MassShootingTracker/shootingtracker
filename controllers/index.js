'use strict';

var _ = require('lodash');
var Api = require('./api');
var path = require('path');
var moment = require('moment');
var config = require('../config');
var Data = require('../services/data.js').Data;
var dataLayer = null;
var app = null;
var currentYear = new Date().getFullYear() + '';

function Index(appArg) {
  this.app = appArg;
  dataLayer = new Data(config, config.logger);
  app = this.app;
  _.bindAll(this, 'home');
}

module.exports = Index;

Index.prototype.register = function () {
  var datapage = this.datapage;
  var logger = config.logger;
  if (!(logger)) {
    throw("Failed to find logger. Logger is required.")
  }
  this.app.get('/', this.home);
  this.app.get('/about', this.aboutus);
  this.app.get('/data', this.datapage);
  this.app.get('/data/:year', this.datapage);

  this.app.post('/archive', function (req, res, next) {

    logger.info('attempting to archive unarchived urls');

    if (req.body.key !== config.app.apiKey) {
      logger.error("posted key incorrect: got:" + req.body.key + " expected:" + config.app.apiKey);
      return res.status(403).send('Invalid Key');
    }
    logger.debug("api key correct, starting update");

    dataLayer.connectToMongo().then(dataLayer.processArchives)
      .then(function (message) {
        logger.info('done with archiving, result: ' + message);
        res.status(200).send(message);
      })
      .catch(function (message) {
        logger.error('archiving failed: ' + message);
        res.status(500).send(message);
        next()
      });
  });

  this.app.post('/update', function (req, res, next) {

    logger.debug('attempting update');

    if (req.body.key !== config.app.apiKey) {
      logger.error("posted key incorrect: got:" + req.body.key + " expected:" + config.app.apiKey);
      return res.status(403).send('Invalid Key');
    }

    logger.debug("api key correct, starting update");
    var year = req.body.year || '' + new Date().getFullYear();

    dataLayer.pullSheetData(year)
      .then(function (sheet) {
        return dataLayer.updateFromCSV(sheet);
      })
      .then(function (results) {
        res.status(200).send('Done')
      })
      .catch(next);
  });

  (new Api(this.app)).register();
};

Index.prototype.home = function home(req, res, next) {

  var year = String(new Date().getFullYear());

  res.locals.data = {
    mostRecent:[],
    currentYear:year,
    totalCurrentYear:'',
    totalAllYears:'',
    daysSince:'',
    daysLabel:'days'
  };

  dataLayer.getTotals()
    .then(function (totals) {

      if (!totals) {
        return;
      }

      totals.mostRecent = _.map(totals.mostRecent, function (shooting) {
        shooting.displayDate = new moment(shooting.date).format('MM/DD/YYYY');
        return shooting;
      });

      res.locals.data = {
        mostRecent:totals.mostRecent,
        currentYear:year,
        totalCurrentYear:totals[currentYear],
        totalAllYears:totals.totalAllYears,
        daysSince:totals.daysSince,
        daysLabel:totals.daysSince === 1 ? 'day' : 'days'
      };

      config.logger.debug({data:res.locals.data});
    })
    .then(function () {
      res.render('index');
    })
    .catch(next);

};

Index.prototype.aboutus = function aboutus(req, res, next) {
  res.render('aboutus');
};

Index.prototype.datapage = function datapage(req, res, next) {
  var isAllYears = req.params.year === 'all';

  var year = req.params.year || String(new Date().getFullYear());

  config.logger.debug('building datapage with param: ' + year);
  dataLayer.getByYear(year).then(function (shootings) {
    app.locals.data = shootings;
    var currentYear = +new Date().getFullYear();

    app.locals.downloads = Object.keys(config.googleDocs).filter(function (key) {
      return +key <= currentYear;
    }).map(function (key) {
      return {
        year:String(key),
        link:config.googleDocs[key]
      };
    });

    app.locals.years = [];
    app.locals.year = year;
    var firstYear = 2013; // first year that has data
    var n = firstYear;
    var c = '';
    while (n <= currentYear) {
      if (+year == n || isAllYears) {
        c = 'active'
      } else {
        c = ''
      }
      app.locals.years.push({year:n++, class:c});
    }
    //console.dir(data[0])

    var _i, _len, shooting;
    for (_i = 0, _len = shootings.length; _i < _len; _i++) {
      shooting = shootings[_i];
      shooting.displayDate = new moment(shooting.date).format("MM/DD/YYYY");
      shooting.number = shootings.length - _i;
    }

    var displayYear = year;
    if (isAllYears) {
      displayYear = 'all years (' + firstYear + ' - ' + currentYear +')';
    }
    res.render('data', {
      dataJson:JSON.stringify(shootings),
      year:displayYear
    });
  })
    .catch(next);
}
