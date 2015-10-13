'use strict';

var gulp = require('gulp');
var sequence = require('run-sequence');


// Make Gulp exit
gulp.on('stop', function () {
  process.nextTick(function () {
    process.exit(0);
  });
});


// Make Gulp exit with a non-zero error code
gulp.on('err', function (error) {
  console.error(error);
  process.nextTick(function () {
    process.exit(1);
  });
});

// Tasks
require('./task/build');
require('./task/run');
require('./task/watch');

// Default Task
gulp.task('default', function(callback) {

  sequence('build',
           'lint',
           'checkstyle',
           'test',
           callback);
});