#moment = require('moment')
request = require('request')
http = require('http')
Reference = require('.././data/schema/reference')

submitUrl = "https://archive.is/submit/"
getUrl = "https://archive.is/"

class ArchiveIS

  constructor: (@logger) ->

  save: (url, cb) =>
    @logger.trace "ArchiveIS tool requesting save for #{url}"
    request.post( submitUrl, { form: url: url, anyway: 1 }, (error, response, body) =>
      if error or !response or (response.statusCode >= 400)
        @logger.warn "save for url #{url} failed! Status code: #{response.statusCode}"
        cb?(error, null)
      else
        @logger.trace "save for url #{url} complete"
        cb?(null, {body: body, response: response})
    )

  check: (url, cb) =>
    archUrl = "#{getUrl}/#{url}"
    @logger.trace "ArchiveIS tool checking #{url} -- #{archUrl}"
    # request.post getUrl, { form: search: url},
    request.get( archUrl, {}, (error, response, body) ->
      if !error
        cb?(null, {found: (body.indexOf('No results') == -1), url: archUrl})
      else
        cb?(error, null)
    )


module.exports = ArchiveIS