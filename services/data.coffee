# mocha --compilers coffee:coffee-script/register ./test/integration/redisMongoDocs.coffee --timeout=45000 --ui bdd --debug-brk

w = require('when')
node = require('when/node')
callbacks = require('when/callbacks')
mongoose = require('mongoose')
Shooting = require('.././data/schema/shooting')
Reference = require('.././data/schema/reference')

redis = require 'redis'
moment = require('moment-timezone')
parallel = require('when/parallel');

redisTTL = 1 * 60 * 60
nodefn = require('when/node')
request = require('request')
Converter = require('csvtojson').Converter
ld = require 'lodash'
webCapture = null
archiver = null
logger = null

class Data

  constructor: (config, @logger) ->
    unless config?
      throw 'config is required!'

    webCapture = new (require './webCapture')(null, @logger)
    archiver = new (require './archive_is')(@logger)

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
    logger = @logger

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
    logger.debug "data sample"
    logger.debug dataSample: data[0] if data?[0]?
    if (not data) or data.length == 0
      logger.warn "data input is 0, returning"
      return 0
    deleteRedisKey = @deleteRedisKey

    promise = w.promise (resolve, reject) =>
      unless data? and year?
        ### TODO: ridiculous hack, I don't know why updateFromCSV is being called twice - MC 9Dec2015 ###
        logger.trace "hit the hack path in updateFromCSV :( oh well just keep going :/"
        return resolve(0)

      @connectToMongo()
      .then(() => Shooting.find(year: +year).remove())
      .then( logger.info("removed all records for year:#{year}") )
      .then((conn) ->
        try
          logger.debug 'connected to mongo; pushing new values into db'
          ref = data
          total = data.length
          checked = 0
          n = 0
          i = 0
          len = ref.length

          if len == 0
            logger.warn "no values found, returning"
            resolve(0)

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
            unless d.date?
              logger.error("row ##{i + 1} is missing a date entry. skipping")
              i++
              continue

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
              logger.info "done writing data to Mongo: #{checked} records"
              logger.info 'deleting redis keys'
              for year in ld.uniq(yearsInCSV)
                deleteRedisKey('' + year)
              deleteRedisKey('totals')
              deleteRedisKey('all')
              logger.info( 'deleted redis keys')
              resolve(checked)

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
        reject(err) if err?
        logger.debug "csv records count": result.length
        resolve(result)

  processArchives: (cb) =>
    promise = w.promise (resolve, reject) =>
      # we are doing 20 of these at a time with a delay to avoid getting cut off by archive.is
      logger.debug 'finding unarchived documents'
      try
        Reference.find(
          archiveUrl: {$eq: null}
        )
        .limit(20)
        .exec (err, docs) ->
          c = docs.length
          if c == 0
            resolve("No update needed.")
          if err?
            reject(err)

          d = 0
          e = 0
          delayInc = 200
          delay = 100
          logger.debug "checking archive for #{c} entries"

          checkExit = ->
            if e >= c
              message = "All urls failed. See logs."
              reject(message)
            else if e > 0
              message = "Some urls encountered an error, check logs."
            else if d >= c
              message = "OK"
            if !!message
              resolve(message)

          checkUrl = (url, doc) ->
            # check the url with archive.is site
            logger.debug "checking archive for url: #{url}"
            archiver.check(url, (err, result) ->
              if err?
                ++e
                logger.error(error: err)
                reject(err)
              if result.url?
                logger.debug "archive url for #{url}: #{result.url}; saving"
                doc.archiveUrl = result.url
                doc.save()
              else
                logger.error("result.url was empty")
                reject("archiver check failed")
              # take a screenshot
              unless doc.screenshotPath?
                logger.debug "capture screenshot for url: #{url}"
                webCapture.capture(url, (err, path) ->
                  if err?
                    ++e
                    logger.error("capture failed for url: #{url}")
                    logger.error("document:")
                    logger.error(document: doc.model)
                    logger.error(error: err)
                    return
                  else
                    ++d
                    doc.screenshotPath = path
                    doc.save()
                    checkExit()
                )
              else
                ++d
                doc.save()
                checkExit()
            )

          for doc in docs
            do (url = doc.url, doc = doc) ->
              setTimeout( (-> checkUrl(url, doc) ), delay)
              delay += delayInc
      catch e
        logger.error(error: e)
        reject(e)

    return promise

  pullSheetData: (year) =>
    logger = @logger
    this.timeout = 5000
    promise = w.promise (resolve, reject) =>
      csvUrl = @csvUrls[year]
      unless csvUrl?
        logger.error "couldn't find CSV url for year: #{year}"
        reject("Failed. See logs.")
      logger.debug "pulling data for year: #{year} from  " + csvUrl
      @connectToMongo().then(
        => @getSheet(csvUrl))
      .then((sheetStr) => @csvToJSON(sheetStr))
      .then((csvJSONresults) =>
        promise = w.promise (resolve, reject) =>
          ###
            when new sources come in we store them but don't request that they be archived
            this is so that we don't swamp archive.is
            there will be a cron job that runs every 30 minutes and archives a few links at a time
          ###
          urls = []
          for json in csvJSONresults
            for source in json.sources_semicolon_delimited.split(';')
              urls.push(source)

          logger.debug "adding Reference records"

          c = urls.length
          d = 0

          if c == 0
            logger.warn "no records found, skipping"
            resolve(csvJSONresults)
            return

          for url in urls
            do (url) =>
              logger.trace "checking url: #{url}"
              Reference.find(
                url: url
              ).exec((err, docs) ->
                ++d
                if err?
                  logger.error err
                  reject(err)
                else if docs?.length == 0
                  logger.trace "creating new Reference"
                  new Reference(url: url, archiveUrl: null, capturePath: null).save()
                else
                  logger.trace "reference exists, skipping"

                if d >= c
                  resolve(csvJSONresults)
              )
        return promise)
      .then((data) =>
        @updateFromCSV({data: data, year: year}))
      .then((result) =>
        logger.debug "data pull complete: #{result}"
        resolve(result))
      .catch((err)-> reject(err))

module.exports.Data = Data
