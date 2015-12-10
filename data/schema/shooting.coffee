mongoose = require('mongoose')

shooting = new mongoose.Schema({
  date: Date,
  year: {type: Number, index: true}
  city: String,
  state: String,
  perpetrators: [{name: String}],
  location: {lat: Number, lon: Number},
  killed: {type: Number, default: 0},
  wounded: {type: Number, default: 0},
  comments: [{date: Date, text: String}], # idea here is that moderators can see comments; this could be a place to discuss problems with the entry
  categories: [String],
  sources: [String],
  flagged: [{by: String, date: Date}],
  disabled: {by: String, date: Date, remarks: String}
})

module.exports = mongoose.model('shooting', shooting)
