w = require('when')
node = require('when/node')
callbacks = require('when/callbacks')
mongoose = require('mongoose')
Shooting = require('.././data/schema/shooting')
redis = require 'redis'
moment = require 'moment'
dayInSeconds = 24*60*60

class Data

  constructor: (config, @logger) ->
    unless config?
      throw 'config is required!'

    @redisPort = config.redis.port
    # mongodb://[username:password@]host1[:port1]
    userpass = ''
    if config.mongo.user?
      unless config.mongo.password?
        throw 'no password, password is required if user is set'
      userpass = "#{config.mongo.user}:#{config.mongo.password}@"

    @mongoURL = "mongodb://#{userpass}#{config.mongo.url}"
    unless @logger?
      @logger = (require 'bunyan')({name: 'mst-data'})

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
          logger.debug 'connected to mongo; proceeding'
          @mongoConn = mongoose.connection
          resolve(mongoose.connection)

    return promise

  deleteRedisKey: (key) =>
    getConn = @getRedisConn
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
      logger.debug 'connecting to redis'

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
                logger.debug 'connected to mongo; proceeding'

                #  moment("2014 04 25", "YYYY MM DD");
                begin = moment("#{year} Jan 01", 'YYYY mmm DD')
                end = moment("#{+year + 1} Jan 01", 'YYYY mmm DD')

                Shooting.find(date: {$gte: begin, $lt: end}).exec( (err, shootings) ->
                  if err?
                    reject(err)
                  else
                    ### store in redis with a one day TTL ###
                    redisClient.set(year, JSON.stringify(shootings))
                    redisClient.expire(year, dayInSeconds)
                    resolve(shootings)
                )
              )
        )
      )

    return promise


  ###
    return value:
    {
      {"totalAllYears": 000},
      {"2014": 111},
      {"2015": 222},
      {"hoursSince": 00}
  }
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
            reply = JSON.parse(reply)
            if reply? and reply.length? and reply.length > 0
              ### found in redis, return that ###
              logger.debug 'found in redis, returning'
              resolve(reply)
            else
              ### redis returned an empty set, get from mongo ###
              getMongoConn().catch((err)-> reject(err)).then((dbconn) ->

                logger.debug 'connected to mongo; proceeding'

                currentYear = (new Date().getFullYear())
                result = []

                Shooting.count().exec( (err, count) ->
                  if err?
                    reject(err)
                    return

                  result.push(totalAllYears: count)

                  now = new moment()

                  # MyModel.find(query, fields, { skip: 10, limit: 5 }, function(err, results) { ... });

                  Shooting.find().sort('-date').take(1).exec( (err, docs) ->
                    lastDate = docs[0].date
                    duration = moment.duration(lastDate.diff(now))
                    hours = duration.asHours()
                    result.push(hoursSince: hours)

                    for year in [startYear..currentYear]
                      do (year) ->
                        Shooting.count(date: {$gte: new Date(year, 1, 1), $lte: new Date(year, 12, 31)}).exec( (err, count) ->
                          if err?
                            reject(err)
                          else
                            result.push {year: year, count: count}
                            if (year == currentYear)

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

    unless data.shootings?
      throw "no shootings element found in CSV data"

    mongoose.connect(@mongoURL)

    promise = w.promise (resolve, reject) ->
      db = mongoose.connection
      db.on 'error', ->
        reject(arguments)

      db.once 'open', (callback) ->
        console.log 'connected to mongo; proceeding'
        d = undefined
        i = undefined
        len = undefined
        ref = data.shootings
        total = data.shootings.length
        checked = 0
        n = 0
        i = 0
        len = ref.length

        while i < len
          d = ref[i]
          entry = new Shooting
          entry.date = new Date(d.date)
          entry.perpetrators = [ { name: d.name } ]
          entry.killed = d.killed
          entry.city = d.city
          entry.wounded = d.wounded
          entry.city = d.location.split(',')[0]
          entry.state = d.location.split(',')[1].trim()
          entry.sources = d.sources

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
                  console.dir entry
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

  getSummary: () =>
    @logger.trace "getting summary"
    promise = w.promise (resolve, reject) ->

    return promise

module.exports.Data = Data