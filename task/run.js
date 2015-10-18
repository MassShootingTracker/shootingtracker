'use strict';

var gulp = require('gulp');
var nodemon = require('gulp-nodemon');
var shell = require('gulp-shell');
var _ = require('lodash');
var sequence = require('run-sequence');
var yargs = require('yargs').argv;

var task = require('./index');
var debugServer = !!yargs.debug;

gulp.task('run', function(callback) {
  sequence(['run:nodemon'], callback);
});

gulp.task('run:nodemon', function(callback) {

  var scriptArgs = task.getConfigFiles();

  if (yargs.refreshData) {
    scriptArgs.push(['--refreshData']);
  }

  var stream = nodemon({
    args: scriptArgs,
    ignore: 'data/*',
    ext: 'js json hbs',
    nodeArgs: debugServer ? ['--debug'] : [],
    script: './index.js',
    verbose: !!(yargs.verbose || yargs.V)
  });

  stream.on('end', callback);

});

gulp.task('run:all', function(callback) {
  /*jshint unused:false */
  sequence('build:site:image',
           'build:site:font',
           'build:site:style',
           function() {

    sequence.apply(this, 'run:nodemon');
    sequence('watch:all');

  });
});

gulp.task('run:prod', function(callback) {
  /*jshint unused:false */
  sequence('build',
           function() {
    require('../index');
  });
});

gulp.task('run:fast', [
  'run:nodemon',
  'watch:fast'
]);

gulp.task('run:fast:build', function(callback) {
  /*jshint unused:false */
  sequence('build:site:image',
           'build:site:font',
           'build:site:style',
           function() {

    sequence.apply(this, ['run:nodemon']);
    sequence('watch:fast');

  });
});
