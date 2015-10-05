'use strict';

var assert = require('assert');
var util = require('util');

var gulp = require('gulp');
var gutil = require('gulp-util');
var prettyHrtime = require('pretty-hrtime');
var sequence = require('run-sequence');
var watchify = require('watchify');

var task = require('./index');
var build = require('./build');


exports.watchBundler = function watchBundler(options) {
  options = options || {};

  assert(options.bundler, 'Missing bundler');
  assert(options.task, 'Missing task name');
  assert(options.file, 'Missing destination file');

  var bundler = watchify(options.bundler);

  bundler.on('update', function() {
    return exports.rebundle(options.task, options.bundler, options.file);
  });

  if (options.init) {
    return exports.rebundle(options.task, options.bundler, options.file);
  }
};


exports.rebundle = function rebundle(task, bundler, file) {

  var start = process.hrtime();
  var stream = build.bundleJS(bundler, file);
  task = gutil.colors.cyan(task);

  gutil.log(util.format('Starting \'%s\'...', task));

  stream.on('end', function() {
    var time = prettyHrtime(process.hrtime(start));
    time = gutil.colors.magenta(time);
    gutil.log(util.format('Finished \'%s\' after %s', task, time));
  });

  return stream;

};


gulp.task('watch:all', function(callback) {
  sequence(['watch:site:all',
            'watch:manifest'],
            callback);
});


gulp.task('watch:fast', function(callback) {
  sequence(['watch:site:fast'],
            callback);
});


gulp.task('watch:manifest', function() {

  var src = [
    'public/css/main.min.css',
    'public/js/main.min.js'
  ];

  task.watch(src, function(stream, callback) {
    sequence('build:manifest', callback);
  });

});

gulp.task('watch:site:all', [
  'watch:site:font',
  'watch:site:image',
  'watch:site:script',
  'watch:site:script:minify',
  'watch:site:style',
  'watch:site:style:minify',
  'watch:site:tests',
]);

gulp.task('watch:site:fast', [
  'watch:site:script',
  'watch:site:style'
]);


gulp.task('watch:site:font', function() {
  return task.watch('client/font/**/*.*', function(stream, callback) {
    sequence('build:site:font', callback);
  });
});


gulp.task('watch:site:image', function() {
  return task.watch('client/img/**/*.*', function(stream, callback) {
    sequence('build:site:image', callback);
  });
});


gulp.task('watch:site:script', function(callback) {
  /*jshint unused:false */
  exports.watchBundler({
    bundler: build.getSiteBundler(watchify.args),
    task: 'build:site:script',
    file: 'main.js',
    init: true
  });
});


gulp.task('watch:site:script:minify', function() {
  return task.watch('public/js/main.js', function(stream, callback) {
    sequence('minify:site:script', callback);
  });
});


gulp.task('watch:site:style', function() {
  return task.watch('client/style/**/*.scss', function(stream, callback) {
    sequence('build:site:style', callback);
  });
});


gulp.task('watch:site:style:minify', function() {
  return task.watch('public/css/site.css', function(stream, callback) {
    sequence('minify:site:style', callback);
  });
});


gulp.task('watch:site:tests', function(callback) {
  /*jshint unused:false */
  exports.watchBundler({
    bundler: build.getSiteBundler('./test/client/index.js', watchify.args),
    task: 'build:site:tests',
    file: 'test.js',
    init: true
  });
});
