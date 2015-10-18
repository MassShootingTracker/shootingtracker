'use strict';

var when = require('when');
var express = require('express');
var bodyParser = require('body-parser');
var methodOverride = require('method-override');
var config = require('./config');
var exphbs  = require('express-handlebars');
var Controllers = require('./controllers');
var Services = require('./services');
var argv = require('yargs').argv;

var shootingData = require('./data/shootings.json');

exports.start = function start(environment) {

var app = express();

app.engine('.hbs', exphbs({
  extname: '.hbs',
  layoutsDir: 'views/layouts/',
  partialsDir: 'views/partials/',
  defaultLayout: 'main'
}));

app.set('view engine', '.hbs');
app.set('port', (process.env.PORT || config.app.port));
app.set('hostname', (process.env.HOSTNAME || config.app.hostname));

app.use(express.static('public'));

app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

app.use(methodOverride());

(new Controllers(app)).register();
(new Services(app));

app.use(function(err, req, res, next) {
  if (err) {
    console.error(err.stack);
    res.status(500).send('Internal server error');
  }
});

if (argv.refreshData) {
  console.log('--refreshData flag set. Refreshing data from google doc at: ' + config['google-docs'].url);
}

(argv.refreshData ? app.services.googledocs.refreshLocalData() : when.resolve())
  .then(function() {

    app.locals.data = argv.refreshData ? shootingData : require('./data/shootings.json');

    var server = app.listen(app.get('port'), app.get('hostname'), function () {

      var host = server.address().address;
      var port = server.address().port;

      console.log('App listening at http://%s:%s', host, port);
    });
  })
  .catch(function(err) {
    console.error(err.stack);
        console.log('error: ' + err.message);

  });