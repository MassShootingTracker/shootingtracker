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

  constructor: (saveDir) ->

  capture: (url, cb) =>
    hostName = new urlLib.parse(url).hostname
    fileName = sanitize(url).replace(".", "_")
    pathWithHost = path.join(process.cwd(), capturesSavePath, sanitize(hostName))
    @captureList = null
    capturePath = path.join(pathWithHost, "#{fileName}-#{new moment().format('DD-MMM-YYYY')}.png")
    options =  shotSize: { width: captureWidth , height: captureHeight, quality: captureQuality }

    ###
      url: {type: String, index: true},
      archiveUrl: String,
      screenshot: String
    }
    ###
    # does a capture need to be done?
    Reference.find(url: url).exec( (err, docs) ->
      if err?
        cb(err, null)

      else
        if docs.length > 0
          cb(true)
        else
          webshotLib(url, capturePath, options, (err) ->
            if err? cb(err, null)
            else cb(null, capturePath)
          )
    )



module.exports = WebCapture

