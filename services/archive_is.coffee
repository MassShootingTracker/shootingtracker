#moment = require('moment')
request = require('request')
http = require('http')
Reference = require('.././data/schema/reference')

submitUrl = "https://archive.is/submit/"
getUrl = "https://archive.is/"
timeMapUrl = 'http://archive.is/timemap/'

class ArchiveIS

  constructor: (@logger) ->

  save: (url, cb) =>
    @logger.trace "ArchiveIS tool requesting save for #{url}"
    request.post(submitUrl, {
      form:
        url: url, anyway: 1
    }, (error, response, body) =>
      if error or !response or (response.statusCode >= 400)
        @logger.warn "save for url #{url} failed! Status code: #{response.statusCode}"
        cb?(error, null)
      else
        @logger.trace "save for url #{url} complete"
        cb?(null, {body: body, response: response})
    )

  check: (url, cb) =>
    tmUrl = timeMapUrl + url
    @logger.debug "ArchiveIS tool checking #{url}"
    @logger.trace tmUrl

    # $ curl  http://archive.is/timemap/http://abc13.com/news/at-least-nine-people-shot-at-two-different-locations-across-area/1200220/
    # TimeMap does not exists. The archive has no Mementos for the requested URI

    request.get(tmUrl, {timeout: 10000}, (error, response, body) ->
      if error?
        cb?(error, null)
      else
        if (not response?)
          cb?({message: "Archive timemap check failed, no response"}, null)
        else if response.statusCode == 404 or response.statusCode == 504
          cb?(null, found: false, url: tmUrl)
        else if  response.statusCode == 200
          cb?(null, found: body.indexOf('does not exists') == -1, url: tmUrl)
        else
          cb?({message: "Archive timemap check failed, statuscode was no 404, 504, 200"}, null)
    )


module.exports = ArchiveIS