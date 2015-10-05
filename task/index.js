'use strict';

var path_ = require('path');

var _ = require('lodash');
var gulpif = require('gulp-if');
var gulpnewer = require('gulp-newer');
var gulpwatch = require('gulp-watch');
var yargs = require('yargs').argv;


exports.PROJECT_DIR = path_.resolve(path_.join(__dirname, '..'));


exports.getConfigFiles = function getConfigFiles() {
  return _.filter(((yargs.config || '') + '').split(','));
};


exports.newer = function newer(options) {
  return gulpif((!yargs.force && !yargs.f), gulpnewer(options));
};


exports.path = function path() {

  var args = _.filter(_.flatten(arguments));

  if (args.length > 0) {
    return path_.resolve(exports.PROJECT_DIR, path_.join.apply(path_, args));
  }

};


exports.watch = function watch(glob, callback) {
  glob = (_.isString(glob) || _.isArray(glob)) ? {glob: glob} : glob;
  glob = _.defaults({}, glob, {
    emitOnGlob: false
  });

  return _.isFunction(callback) ? gulpwatch(glob, callback) : gulpwatch(glob);
};
