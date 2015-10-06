//module.exports = require('./local.json');

module.exports = {
  "app": {
    "port": 3000,
    "apiKey": process.env.API_KEY
  },
  "google-docs": {
    "url": process.env.GOOGLE_DOC_URL
  }
}