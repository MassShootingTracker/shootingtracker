'use strict';

var gulp = require('gulp');
var nodemon = require('gulp-nodemon');
var shell = require('gulp-shell');
var _ = require('lodash');
var sequence = require('run-sequence');
var yargs = require('yargs').argv;

var task = require('./index');

var debugServer = !!(yargs['debug-server'] || yargs.debug);

var runTasks = _.filter([
  'run:nodemon',
  debugServer ? 'run:inspector' : ''
]);


gulp.task('run', function(callback) {
  sequence(runTasks, callback);
});


gulp.task('run:inspector', shell.task('node-inspector', {
  ignoreErrors: true
}));


gulp.task('run:nodemon', function(callback) {

  var stream = nodemon({
    args: task.getConfigFiles(),
    ext: 'js json jade',
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

    sequence.apply(this, runTasks);
    sequence('watch:all');

  });
});


gulp.task('run:fast', runTasks.concat([
  'watch:fast'
]));


gulp.task('run:fast:build', function(callback) {
  /*jshint unused:false */
  sequence('build:site:image',
           'build:site:font',
           'build:site:style',
           function() {

    sequence.apply(this, runTasks);
    sequence('watch:fast');

  });
});
