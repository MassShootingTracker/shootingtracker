#moment = require('moment')
request = require('request')
http = require('http')
Reference = require('.././data/schema/reference')

submitUrl = "https://archive.is/submit/"
getUrl = "https://archive.is/"

class ArchiveIS

  constructor: () ->

  save: (url, cb) =>
    console.log "ArchiveIS tool requesting save for #{url}"
    request.post submitUrl, { form: url: url, anyway: 1 }, (error, response, body) ->
      if !error or response.statusCode != 200
        cb?(error, null)
      else
        cb?(null, {body: body, response: response})

  check: (url, cb) =>
    console.log "ArchiveIS tool checking #{url} -- #{getUrl}/#{url}"
    # request.post getUrl, { form: search: url},
    request.get "#{getUrl}/#{url}", {}, (error, response, body) ->
      if !error
        cb?(null, {found: (body.indexOf('No results') == -1)})
      else
        cb?(error, null)

module.exports = ArchiveIS
