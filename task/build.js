'use strict';

var path = require('path');
var browserify = require('browserify');
var gulp = require('gulp');
var autoprefixer = require('gulp-autoprefixer');
var chmod = require('gulp-chmod');
var concat = require('gulp-concat');
var csso = require('gulp-csso');
var expect = require('gulp-expect-file');
var rename = require('gulp-rename');
var rev = require('gulp-rev');
var rimraf = require('gulp-rimraf');
var streamify = require('gulp-streamify');
var sass = require('gulp-sass');
var uglify = require('gulp-uglify');
var gutil = require('gulp-util');
var _ = require('lodash');
var sequence = require('run-sequence');
var S = require('string');
var source = require('vinyl-source-stream');
var yargs = require('yargs').argv;

var task = require('./index');

exports.PERMISSIONS = {
  owner: {
    execute: false
  },
  group: {
    execute: false
  },
  others: {
    execute: false
  }
};


exports.minifyCSS = function minifyCSS(stream) {
  return stream
    .pipe(rename({ suffix: '.min' }))
    .pipe(csso())
    .pipe(gulp.dest('.tmp/public/css'))
    .pipe(gulp.dest('public/css'));
};

exports.minifyJS = function minifyJS(stream) {
  return stream.pipe(rename({ suffix: '.min' }))
    .pipe(streamify(uglify()))
    .pipe(gulp.dest('.tmp/public/js'))
    .pipe(gulp.dest('public/js'));
};

exports.bundleCSS = function bundleCSS(src, callback) {

  gulp.src(src)
    .pipe(sass().on('error', sass.logError))
    .pipe(autoprefixer({
      cascade: false
    }))
    .pipe(rename({
      dirname: '',
      extname: '.css'
    }))
    .pipe(chmod(exports.PERMISSIONS))
    .pipe(gulp.dest('.tmp/public/css'))
    .pipe(gulp.dest('public/css'))
    .on('error', callback)
    .on('end', callback);
};


exports.bundleJS = function bundleJS(bundler, entry) {
  return bundler.bundle()
    .on('error', gutil.log.bind(gutil, 'Browserify Error'))
    .pipe(source(path.basename(entry)))
    .pipe(chmod(exports.PERMISSIONS))
    .pipe(gulp.dest('.tmp/public/js'))
    .pipe(gulp.dest('public/js'));
};


exports.getSiteBundler = function getSiteBundler(entries, options) {
  /* jshint maxcomplexity:8 */
  if (_.isObject(entries)) {
    options = entries;
    entries = undefined;
  }

  options = _.merge({}, options, {
    extensions: ['.coffee'],
    standalone: 'HD',
    debug: !!(yargs['debug-client'] || yargs.debug)
  });

  if (!entries) {
    entries = options.entries;
  }

  if (entries && typeof entries === 'string') {
    entries = [entries];
  }

  if (!Array.isArray(entries)) {
    entries = [];
  }

  if (entries.length < 1) {
    entries = ['./client/script/main.js'];
  }

  options.entries = entries;
  return browserify(options);
};


gulp.task('build', function(callback) {

  var build = [
    'build:site:image',
    'build:site:video',
    'build:site:font',
    'build:site:fonts',
    'build:site:script',
    'build:site:style'
  ];

  var minify = [
    'minify:site:script',
    'minify:site:style'
  ];

  var args = [build, 'build:manifest', callback];

  if (yargs.minify !== false) {
    args.splice(1, 0, minify);
  }

  return sequence.apply(this, args);

});


gulp.task('build:manifest', function(callback) {
  sequence('build:manifest:clean',
           'build:manifest:files',
           callback);
});


gulp.task('build:manifest:clean', function() {

  var old = [
    'public/css/vendor-*',
    'public/css/site-*',
    'public/js/vendor-*',
    'public/js/site-*'
  ];

  return gulp.src(old, {read: false}).pipe(rimraf());

});


gulp.task('build:manifest:files', function() {
  // Creates a map from normal name -> hashed name.
  // See config/manifest.json

  var src = [
    '.tmp/public/css/**/*.css',
    '.tmp/public/js/**/*.js'
  ];

  return gulp.src(src, { base: task.path('./.tmp/public') })
    .pipe(rev())
    .pipe(rename(function(renamePath, file) {

      var basename = path.basename(file.revOrigPath);
      basename = path.basename(basename, renamePath.extname);
      basename = S(basename);

      if (basename.endsWith('.min')) {
        renamePath.basename = basename.chompRight('.min').s +
                              '-' + file.revHash + '.min';
      }

    }))
    .pipe(gulp.dest('public'))
    .pipe(rev.manifest())
    .pipe(rename({ basename: 'manifest' }))
    .pipe(chmod(exports.PERMISSIONS))
    .pipe(gulp.dest('config'));

});

gulp.task('build:site:image', function () {
  return gulp.src(['client/img/**/*.*'], {base: 'client/img'})
    .pipe(task.newer('public/img'))
    .pipe(gulp.dest('public/img'));
});

gulp.task('build:site:video', function () {
  return gulp.src(['client/video/**/*.*'], {base: 'client/video'})
    .pipe(task.newer('public/video'))
    .pipe(gulp.dest('public/video'));
});

gulp.task('build:site:font', function () {
  return gulp.src(['client/font/**/*.*'], {base: 'client/font'})
    .pipe(task.newer('public/font'))
    .pipe(gulp.dest('public/font'));
});

//This is for font awesome resources, so we don't have to muck with font awesome's css file
gulp.task('build:site:fonts', function () {
  return gulp.src(['client/fonts/**/*.*'], {base: 'client/fonts'})
    .pipe(task.newer('public/fonts'))
    .pipe(gulp.dest('public/fonts'));
});

gulp.task('build:site:style', function (callback) {
  return exports.bundleCSS('client/style/site.scss', callback);
});

gulp.task('build:site:script', function() {
  return exports.bundleJS(exports.getSiteBundler(), 'main.js');
});

gulp.task('minify:site:style', function () {
  return exports.minifyCSS(gulp.src('public/css/site.css', { base: 'public/css' }));
});

gulp.task('minify:site:script', function () {
  return exports.minifyJS(gulp.src('public/js/main.js'));
});

gulp.task('minify:vendor:script', function() {
  return exports.minifyJS(gulp.src('public/js/vendor.js'));
});

gulp.task('minify:vendor:style', function() {
  return exports.minifyCSS(gulp.src('public/css/vendor.css'));
});
