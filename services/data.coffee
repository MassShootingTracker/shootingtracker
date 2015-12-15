w = require('when')
node = require('when/node')
callbacks = require('when/callbacks')
mongoose = require('mongoose')
Shooting = require('.././data/schema/shooting')
redis = require 'redis'
moment = require('moment-timezone')

redisTTL = 1 * 60 * 60
nodefn = require('when/node')
request = require('request')
Converter = require('csvtojson').Converter
ld = require 'lodash'
webCapture = new (require './webCapture')()
archiver = new (require './archive_is')()

class Data

  constructor: (config, @logger) ->
    unless config?
      throw 'config is required!'

    @config = config
    @csvUrls = config.googleDocs
    # mongodb://[username:password@]host1[:port1]
    userpass = ''
    if config.mongo.user?
      unless config.mongo.password?
        throw 'no password, password is required if user is set'
      userpass = "#{config.mongo.user}:#{config.mongo.password}@"

    if userpass
      @mongoURL = "mongodb://#{userpass}#{config.mongo.url}"
    else
      @mongoURL = config.mongo.url

    unless @logger?
      @logger = (require 'bunyan')({name: 'mst-data', level: (config.logging?.level? or 10)})


    process.on 'unhandledRejection', (reason, p) =>
      @logger.error 'Possibly Unhandled Rejection at: Promise ', p, ' reason: ', reason

  getRedisConn: =>
    promise = w.promise (resolve, reject) =>
      if @redisClient?
        resolve(@redisClient)
      else
        redisClient = redis.createClient({
          port: @config.redis.port,
          host: @config.redis.host,
          auth_pass: @config.redis.auth_pass,
        })
        redisClient.on('connect', =>
          @redisClient = redisClient
          resolve(redisClient)
        )

        redisClient.on 'error', (err) =>
          @logger.error 'Redis error ' + err
          reject(err)

    return promise

  connectToMongo: =>
    logger = @logger

    promise = w.promise (resolve, reject) =>
      if mongoose.Connection.STATES.connected == mongoose.connection.readyState
        resolve(true)
      else
        mongoose.connect @mongoURL
        mongoose.connection.on 'error', (args) ->
          logger.error(args)
        mongoose.connection.once 'open', =>
          @logger.debug 'Mongo connection open'
          @logger.debug args: arguments
          resolve(true)

    return promise

  deleteRedisKey: (key) =>
    getConn = @getRedisConn
    @logger.debug "deleting redis key '#{key}'"
    promise = w.promise (resolve, reject) ->
      getConn().catch((err)-> reject(err)).then((redisClient) ->
        redisClient.del(key, (err) ->
          if err?
            reject(err)
          else resolve(true)
        )
      )
    return promise

  getRedisKeys: () =>
    promise = w.promise (resolve, reject) =>
      @logger.debug "getting all redis keys"

      @getRedisConn().then((redisClient) ->
        redisClient.keys('*', (err, keys) ->
          reject(err) if err?
          resolve(keys)
        )
      )

    return promise

  getByYear: (year) =>
    year ?= 'all'
    @logger.debug "getting by year for #{year}"
    logger = @logger
    redisURL = @redisURL
    getMongoConn = @connectToMongo

    promise = w.promise (resolve, reject) =>
      logger.trace 'connecting to redis'

      @getRedisConn().catch((err) -> reject(err)).then((redisClient) ->
        redisClient.get(year, (err, reply) ->
          if err?
            logger.error err
            reject(err)
          else
            reply = JSON.parse(reply)
            if reply? and reply.length? and reply.length > 0
              ### found in redis, return that ###
              logger.debug "key #{year} found in redis, returning"
              resolve(reply)
            else
              logger.trace 'not found in redis'
              ### redis returned an empty set, get from mongo ###
              getMongoConn().catch((err)-> reject(err)).then((dbconn) ->
                logger.trace "pulling by year from mongo for #{year}"

                #  moment("2014 Apr 25", "YYYY mmm DD");

                if year != 'all'
                  begin = moment("#{year} Jan 01", 'YYYY mmm DD').year()
                  end = moment("#{+year + 1} Jan 01", 'YYYY mmm DD').year()
                else
                  begin = moment().subtract(20, 'years').year();
                  end = moment().add(1, 'years').year();

                logger.trace(begin: begin, end: end)

                ### TODO: this can be cleaned up a bit since year is now a property of the entry ###
                Shooting.$where("this.year >= #{begin} && this.year < #{end}").sort('-date').exec((err, shootings) ->
                  logger.debug('# shootings', shootings?.length or 0)
                  if err?
                    reject(err)
                  else
                    logger.trace "got shootings for year; storing in redis"
                    logger.trace "modifying displayed year"

                    ### store in redis with a one day TTL ###
                    redisClient.set(year, JSON.stringify(shootings))
                    redisClient.expire(year, redisTTL)

                    resolve(shootings)
                )
              )
        )
      )

    return promise

  ###
    return value:
    { '2014': 24, '2015': 279, totalAllYears: 303, daysSince: 2 }
  ###
  getTotals: =>
    promise = w.promise (resolve, reject) =>
      logger = @logger
      logger.debug 'connecting to redis'
      key = 'totals'
      startYear = 2013 # the year we started collecting data
      getMongoConn = @connectToMongo

      @getRedisConn().catch((err)-> reject(err)).then((redisClient) ->
        redisClient.get(key, (err, reply) ->
          if err?
            logger.error err
            reject(err)
          else
            if reply? and (reply != "[]")
              ### found in redis, return that ###
              replyAsObj = JSON.parse(reply)
              logger.debug 'totals found in redis, returning'
              resolve(replyAsObj)
            else
              logger.debug "didn't find totals in redis; pulling fresh"
              ### redis returned an empty set, get from mongo ###
              getMongoConn().catch((err)-> reject(err)).then((dbconn) ->
                result = {}

                Shooting.count().exec((err, count) ->
                  if err?
                    reject(err)
                    return

                  result.totalAllYears = count

                  now = moment()

                  # find the hours since last shooting
                  # MyModel.find(query, fields, { skip: 10, limit: 5 }, function(err, results) { ... });

                  Shooting.find(null, null, {limit: 1}).sort('-date').exec((err, docs) ->
                    if err?
                      reject(err)
                      return

                    if docs.length == 0
                      resolve(null)
                      return

                    lastDate = docs[0].date
                    duration = Math.floor(Math.abs(moment.duration(now.diff(lastDate)).asDays()))
                    result.daysSince = duration

                    Shooting.find(null, null, {limit: 5}).sort('-date').exec((err, mostRecent) ->
                      logger.debug 'got 5 most recent shootings'
                      result.mostRecent = mostRecent

                      # get totals for each year
                      currentYear = (new Date().getFullYear())
                      years = []
                      for year in [startYear..currentYear]
                        years.push(year)
                        do (year) ->
                          Shooting.count({year: year}).exec((err, count) ->
                            if err?
                              reject(err)
                              return
                            else
                              result[year] = count
                              n = 0
                              for year in years
                                if result[year]?
                                  n++
                              if (n == years.length)
                                logger.debug 'setting totals into redis'
                                daysThisYear = Math.floor(Math.abs(moment.duration(moment().diff(new Date(year, 1, 1))).asDays()))
                                result.average = ld.floor(result[year] / daysThisYear, 2)
                                redisClient.set(key, JSON.stringify(result))
                                redisClient.expire(key, redisTTL)
                                resolve(result)
                          )
                    )
                  )
                )
              )
        )
      )

    return promise


  updateFromCSV: (input) =>
    logger = @logger
    logger.trace "starting update from csv"
    yearsInCSV = []
    {data, year} = input
    deleteRedisKey = @deleteRedisKey

    promise = w.promise (resolve, reject) =>
      unless data?
        ### TODO: ridiculous hack, I don't know why updateFromCSV is being called twice - MC 9Dec2015 ###
        logger.warn "no shootings element found in CSV data; ignoring"
        resolve(0)

      @connectToMongo()
        .then(() => Shooting.find(year: +year).remove())
        .then((conn) ->
          try
            logger.debug 'connected to mongo; pushing new values into db'
            ref = data
            total = data.length
            checked = 0
            n = 0
            i = 0
            len = ref.length

            while i < len

              ###
              sample:
              { date: '9/20/2015',
               name: 'Unknown',
               killed: 0,
               wounded: 6,
               city: 'Tulsa',
               state: 'OK',
               synopsis: '',
               guns_info: '',
               other_info: '',
               sources_semicolon_delimited: 'http://www.newson6.com/story/30072412/six-shot-outside-tulsa-nightclub' },

              ###
              d = ref[i]
              entry = new Shooting

              # we're just assuming east coast time here; actual times aren't important, just dates
              # this is so entries on 12/31 don't fall in to the next year
              entry.date = moment.tz(d.date, 'MM/DD/YYYY', "America/Los_Angeles").format()
              entry.year = +entry.date.getFullYear()
              entry.killed = d.killed
              entry.city = d.city
              entry.wounded = d.wounded
              entry.city = d.city
              entry.state = d.state

              if d.sources_semicolon_delimited.indexOf(';') > -1
                # filter out empty sources
                entry.sources = ld.filter(d.sources_semicolon_delimited.split(';'), (x) -> !!x.length)
              else
                entry.sources = d.sources_semicolon_delimited

              if d.name_semicolon_delimited.indexOf(';') > -1
                d.name_semicolon_delimited.split(';').forEach((p) -> entry.perpetrators.push({name: p}))
              else
                entry.perpetrators = [{name: d.name_semicolon_delimited}]

              logger.trace "entry": entry
              yearsInCSV.push(entry.date.getFullYear())
              ###
               find any entries on this data with the same city and state and at least one matching source
               if found, delete and re-create
               else just save each one
              ###

              entry.save()
              ++checked
              if checked == total
                logger.warn "'done writing data to Mongo: #{n} records'"
                logger.info 'deleting redis keys'
                for year in ld.uniq(yearsInCSV)
                  deleteRedisKey('' + year)
                deleteRedisKey('totals')
                deleteRedisKey('all')
                logger.warn 'deleted redis keys'
                resolve(n)

              i++

          catch e
            reject(e)
        ).catch((err) -> reject(err))

    return promise

  getSheet: (url) ->
    unless  url? and !!url
      throw 'getSheet did not receive a valid url'
    nodefn.lift(request)(uri: url).then (result) ->
      w.resolve result[0].body

  csvToJSON: (csvStr) =>
    converter = new Converter({})
    logger = @logger
    promise = w.promise (resolve, reject) ->
      converter.fromString csvStr, (err, result) ->
        if err
          reject err
        logger.debug "csv records count": result.length
    promise
    resolve result

  archiveUrl: (url) =>

    promise = w.promise (resolve, reject) =>
      # check archive.is for this url
      archiver.check url, (err, result) ->
        logger.debug "checked url: #{url}"
        if hadError(err) then reject(err)
        if not result.found
          # save AIS for this url
          logger.trace "saving url with archive.is"

          archiver.save(url, (err, archiveUrl) ->
            if hadError(err) then reject(err)
            # capture shot of this url
            logger.trace "capturing screenshot for url"
            webCapture.capture(url, (err, path) ->
              reject(err) if err?
              else
                logger.trace('capture complete')
                ref = new Reference(url: url, archiveUrl: archiveUrl, screenshotPath: path)
                resolve(true)
            )
          )
        else
          logger.debug "Archive has url, no capture needed."
          resolve(true)

    return promise

  pullSheetData: (year) =>
    this.timeout = 5000
    promise = w.promise (resolve, reject) =>
      csvUrl = @csvUrls[year]
      @logger.debug "pulling data from " + csvUrl
      @getSheet(csvUrl
      ).then((sheetStr) =>
        @csvToJSON( sheetStr )
      ).then(
        (data) ->  {data: data, year: year }
      ).then(
        @updateFromCSV
      ).then( (result) =>
        # TODO parallel
        archiveUrl(result)
      ).then(
        (result) =>
          @logger.debug "data pull complete: #{result}"
          resolve(result)
      ).catch((err)->
        reject(err)
      )

module.exports.Data = Data