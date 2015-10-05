var express = require('express');
var config = require('./config');
var exphbs  = require('express-handlebars');


var Controllers = require('./controllers');

var app = express();

app.engine('.hbs', exphbs({
  extname: '.hbs',
  layoutsDir: 'views/layouts/',
  partialsDir: 'views/partials/',
  defaultLayout: 'main'
}));

app.set('view engine', '.hbs');

app.use(express.static('public'));

(new Controllers(app)).register();

var server = app.listen(config.app.port, function () {
  var host = server.address().address;
  var port = server.address().port;

  console.log('App listening at http://%s:%s', host, port);
});