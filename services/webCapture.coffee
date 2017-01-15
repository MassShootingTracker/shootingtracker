capturesSavePath = process.env.LRF_HOSTS_PATH or 'captures'
captureHeight = process.env.LRF_HEIGHT or 'all'
captureWidth = process.env.LRF_WIDTH or 1440
captureQuality = process.env.LRF_QUALITY or 75

Reference = require('.././data/schema/reference')
path = require 'path'
urlLib = require 'url'
webshotLib = require('webshot')
sanitize = require("sanitize-filename")
fs = require('fs')
moment = require('moment')
ld = require 'lodash'

class WebCapture

  constructor: (saveDir, @logger) ->

  capture: (url, cb) =>
    @logger.trace "capturing url: #{url}"
    hostName = new urlLib.parse(url).hostname

    unless url? and hostName?
      msg = "image capture failed for url: #{url}"
      @logger.error msg
      cb(new Error(msg), null)
      return

    fileName = sanitize(url).replace(".", "_")
    pathWithHost = path.join(capturesSavePath, sanitize(hostName), "#{fileName}-#{new moment().format('DD-MMM-YYYY')}.png")
    @captureList = null
    capturePath = path.join(process.cwd(), pathWithHost)
    options = shotSize: {width: captureWidth, height: captureHeight, quality: captureQuality}

    webshotLib(url, capturePath, options, (err) =>
      if err?
        @logger.trace "capture failed: ", err
        cb(err, null)
      else
        @logger.trace "capture complete: #{pathWithHost}"
        cb(null, pathWithHost)
    )


module.exports = WebCapture

