w = require('when')
node = require('when/node')
callbacks = require('when/callbacks')
mongoose = require('mongoose')
Shooting = require('.././data/schema/shooting')
redis = require 'redis'
moment = require 'moment'
redisTTL = 1*60*60
nodefn = require('when/node')
request = require('request')
Converter = require('csvtojson').Converter
ld = require 'lodash'

class Data

  constructor: (config, @logger) ->
    unless config?
      throw 'config is required!'

    @googleSheetURL = config['google-docs'].url

    @redisPort = config.redis.port
    # mongodb://[username:password@]host1[:port1]
    userpass = ''
    if config.mongo.user?
      unless config.mongo.password?
        throw 'no password, password is required if user is set'
      userpass = "#{config.mongo.user}:#{config.mongo.password}@"

    @mongoURL = "mongodb://#{userpass}#{config.mongo.url}"
    unless @logger?
      @logger = (require 'bunyan')({name: 'mst-data', level: (config.logging?.level? or 10)})

  getRedisConn: =>

    promise = w.promise (resolve, reject) =>
      if @redisClient?
        resolve(@redisClient)
      else
        redisClient = redis.createClient(@redisPort)
        redisClient.on( 'connect', =>
          @redisClient = redisClient
          resolve(redisClient)
        )

        redisClient.on 'error', (err) =>
          @logger.error 'Redis error ' + err
          reject(err)

    return promise

  getMongoConn: =>

    mongoose.connect(@mongoURL)
    logger = @logger

    promise = w.promise (resolve, reject) =>
      if @mongoConn?
        resolve(@mongoConn)
      else
        db = mongoose.connection
        db.on 'error', ->
          reject(arguments)

        db.once 'open',  =>
          logger.trace 'connected to mongo; proceeding'
          @mongoConn = mongoose.connection
          resolve(mongoose.connection)

    return promise

  deleteRedisKey: (key) =>
    getConn = @getRedisConn
    @logger.debug "deleting redis key #{key}"
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

      @getRedisConn().then( (redisClient) ->
        redisClient.keys('*', (err, keys) ->
          reject(err) if err?
          resolve(keys)
        )
      )

    return promise

  getByYear: (year) =>
    @logger.trace "getting by year for #{year}"
    logger = @logger
    redisURL = @redisURL
    getMongoConn = @getMongoConn

    promise = w.promise (resolve, reject) =>
      logger.trace 'connecting to redis'

      @getRedisConn().catch((err)-> reject(err)).then((redisClient) ->

        redisClient.get(year, (err, reply) ->
          if err?
            logger.error err
            reject(err)
          else
            reply = JSON.parse(reply)
            if reply? and reply.length? and reply.length > 0
              ### found in redis, return that ###
              logger.debug 'found in redis, returning'
              resolve(reply)
            else
              ### redis returned an empty set, get from mongo ###
              getMongoConn().catch((err)-> reject(err)).then((dbconn) ->
                logger.trace "pulling by year from mongo"

                #  moment("2014 04 25", "YYYY MM DD");
                begin = moment("#{year} Jan 01", 'YYYY mmm DD')
                end = moment("#{+year + 1} Jan 01", 'YYYY mmm DD')

                Shooting.find(date: {$gte: begin, $lt: end}).exec( (err, shootings) ->
                  if err?
                    reject(err)
                  else
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
      years = new moment()
      key = 'totals'
      startYear = 2014 # the year we started collecting data
      getMongoConn = @getMongoConn

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

                Shooting.count().exec( (err, count) ->
                  if err?
                    reject(err)
                    return

                  result.totalAllYears = count

                  now = new moment()

                  # find the hours since last shooting
                  # MyModel.find(query, fields, { skip: 10, limit: 5 }, function(err, results) { ... });

                  Shooting.find(null, null, { limit: 1 }).sort('-date').exec( (err, docs) ->
                    if err?
                      reject(err)
                      return
                    lastDate = docs[0].date
                    duration = Math.floor(Math.abs( moment.duration(now.diff(lastDate)).asDays() ))
                    result.daysSince = duration

                    # get totals for each year
                    currentYear = (new Date().getFullYear())
                    for year in [startYear..currentYear]
                      do (year) ->
                        Shooting.count(date: {$gte: new Date(year, 1, 1), $lte: new Date(year, 12, 31)}).exec( (err, count) ->
                          if err?
                            reject(err)
                            return
                          else
                            result[year] = count
                            if (year == currentYear)
                              redisClient.set(key, JSON.stringify(result))
                              redisClient.expire(key, redisTTL)
                              resolve(result)
                      )
                  )
                )
          )
        )
      )

    return promise


  updateFromCSV: (data) =>
    logger = @logger
    logger.trace "starting update from csv"

    unless data?
      throw "no shootings element found in CSV data"

    console.dir data: data

    mongoose.connect(@mongoURL)

    promise = w.promise (resolve, reject) ->
      db = mongoose.connection
      db.on 'error', ->
        reject(arguments)

      db.once 'open', (callback) ->
        logger.debug 'connected to mongo; pushing new values into db'
        d = undefined
        i = undefined
        len = undefined
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
           sources_csv: 'http://www.newson6.com/story/30072412/six-shot-outside-tulsa-nightclub' },

          ###
          d = ref[i]
          entry = new Shooting
          entry.date = new Date(d.date)
          entry.killed = d.killed
          entry.city = d.city
          entry.wounded = d.wounded
          entry.city = d.city
          entry.state = d.state

          if d.sources_csv.indexOf(',') > -1
            entry.sources = d.sources_csv.split(',')
          else
            entry.sources = d.sources_csv

          if d.name.indexOf(';') > -1
            d.name.split(';').forEach( (p) -> entry.perpetrators.push({name: p}))
          else
            entry.perpetrators = [{name: d.name}]

          ###
           find any entries on this data with the same city and state and at least one matching source
           if found, delete and re-create
           else just save each one
          ###

          upsert = (entry) ->
            Shooting.find(
              city: entry.city
              state: entry.state
              date: entry.date
              sources: $in: entry.sources).exec( (err, shooting) ->
                # if it exists, delete it
                if err
                  reject(err)
                else if shooting.length > 1
                  # probably needs an IIFE
                  logger.fatal 'found multiple entries! (this should be very rare at best)'
                  logger.fatal (entry: shooting )
                else if shooting.length > 0
                  Shooting.remove { _id: shooting[0]._id }, (err, result) ->
                    entry.save()
                    return
                else
                  ++n
                  entry.save()
                ++checked
                if checked == total
                  logger.warn 'done writing data to Mongo (' + n + ' new records)'
                  resolve(n)
              )

          upsert entry
          i++

    return promise

  getSheet: (url) ->
    unless  @googleSheetURL
      throw 'no google docs url found in config, should be at config["google-docs"].url'
    nodefn.lift(request)(uri: @googleSheetURL).then (result) ->
      w.resolve result[0].body

  csvToJSON:  (csvStr) ->
    converter = new Converter({})
    promise = w.promise (resolve, reject) ->
      converter.fromString csvStr, (err, result) ->
        if err
          reject err
        resolve result
    promise

  pullSheetData: =>
    promise = w.promise (resolve, reject) =>
      @getSheet().then((sheetStr) =>
        @csvToJSON sheetStr
      ).catch((err)-> reject(err)).then (result) =>
        resolve(result)


module.exports.Data = Data