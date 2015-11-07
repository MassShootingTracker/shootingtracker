# mocha --compilers coffee:coffee-script/register ./test/integration/redisMongo.coffee --timeout=45000 --ui bdd -g 'data from the test'

require('source-map-support').install()
ld = require('lodash')
chai = require 'chai'
should = chai.should()
expect = chai.expect
sinon = require('sinon')
path = require 'path'

describe 'GoogleDocs / Redis / Mongo Integration', ->

  before (done) ->
    done()

  after (done) ->
    done()

  beforeEach  (done) ->
    done()

  afterEach (done) ->
    done()

  config = {}

  errorHandler = (err) ->
    throw err

  getDataLayer = ->
    config = require(path.join(process.cwd(),'./config' ))
    logger = new (require 'bunyan')({name: 'errors', level: 50})
    return new (require(path.join(process.cwd(),'./services/data.js' ))).Data(config, logger)

  it 'should get the redis client', (done)->
    dl = getDataLayer()
    dl.should.be
    dl.getRedisConn().then( (redisClient) ->
      redisClient.should.be
      redisClient.should.have.property('stream')
      done()
    )

  it 'should get keys from the redis client', (done)->
    dl = getDataLayer()
    dl.should.be
    dl.getRedisConn().then( (redisClient) ->
      redisClient.should.be
      redisClient.should.have.property('stream')
      redisClient.keys('*', (err, keys) ->
        if err?
          throw err
        else
          keys.should.be
          done()
      )
    )

  it 'should delete a redis key', (done)->
    dl = getDataLayer()
    dl.should.be
    dl.deleteRedisKey('2014').catch( (err) -> throw err).then( (result) ->
      result.should.be.ok
      done()
    )

  it 'should get totals for all years', (done) ->
    dl = getDataLayer()
    dl.should.be
    dl.getTotals().catch(errorHandler).then( (result) ->
      result.should.have.property('2015')
      result.should.have.property('2014')
      result.should.have.property('totalAllYears')
      result.should.have.property('daysSince')
      done()
    )

  it 'should get data for 2015', (done)->
    dl = getDataLayer()
    dl.should.be
    dl.getByYear(2015).catch((err) ->
      throw err
    ).done((shootings) ->
      shootings.should.be
      shootings.length.should.be.gt(200)
      shootings.length.should.be.lt(10000)
      done()
    )

  it 'should get the sheet data', (done)->
    dl = getDataLayer()
    dl.should.be
    dl.pullSheetData(2015).catch((err) ->
      throw err
    ).done((count) ->
      count.should.be
      count.should.be.gt(-1)
      done()
    )

  it 'should throw when no config', ->
    f = -> new (require(path.join(process.cwd(),'./services/data.js' ))).Data()
    f.should.throw(/config is required/)
