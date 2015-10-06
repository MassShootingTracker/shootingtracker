var express = require('express');
var bodyParser = require('body-parser');
var methodOverride = require('method-override');
var config = require('./config');
var exphbs  = require('express-handlebars');
var Controllers = require('./controllers');
var Services = require('./services');

var app = express();

app.engine('.hbs', exphbs({
  extname: '.hbs',
  layoutsDir: 'views/layouts/',
  partialsDir: 'views/partials/',
  defaultLayout: 'main'
}));

app.set('view engine', '.hbs');

app.use(express.static('public'));

app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

app.use(methodOverride());

(new Controllers(app)).register();
(new Services(app));

app.use(function(err, req, res, next) {
  console.error(err.stack);
  res.status(500).send('Internal server error');
});

app.services.googledocs.refreshLocalData()
  .then(function() {

    var server = app.listen(config.app.port, function () {
      var host = server.address().address;
      var port = server.address().port;

      console.log('App listening at http://%s:%s', host, port);
    });
  })
  .catch(function(err) {
    console.error(err.stack);
  });