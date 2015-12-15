mongoose = require('mongoose')

reference = new mongoose.Schema({
  url: {type: String, index: true},
  archiveUrl: String,
  screenshotPath: String
})

module.exports = mongoose.model('reference', reference)
