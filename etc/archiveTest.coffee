# this is code to test behavior of archive.is via nodejs


# Curl: $ curl  http://archive.is/timemap/http://abc13.com/news/at-least-nine-people-shot-at-two-different-locations-across-area/1200220/
# Response: TimeMap does not exists. The archive has no Mementos for the requested URI

request = require('request')
url = "https://www.washingtonpost.com/news/the-fix/wp/2017/01/15/rep-john-lewiss-books-sell-out-following-donald-trumps-attacks"
url = 'http://www.fox19.com/story/31411157/man-accused-in-shooting-that-killed-boy-7-held-on-2m-bail'
tmUrl = "http://archive.is/search/"

if false
  request('http://www.google.com', (error, response, body) ->
    if (!error && response.statusCode == 200)
      console.log(body[0..300]) # Show the HTML for the    Google homepage
  )
formData =
  url: url
# "http://timetravel.mementoweb.org/api/json/2017/http://cnn.com"


# right now this returns a 504 error no matter what!!
request.post(
  {
    url: "http://archive.is/submit/"
    formData: formData
    followAllRedirects: true
    timeout: 60000
    "User-Agent": 'curl/7.43.0'
  }
  ,(error, response, body) ->
    if (!error)
      if (response.statusCode == 200 or response.statusCode == 404)
        console.log(body[0..300])
      else
        console.error "response code", response.statusCode
        console.log(body)
    else
      console.error(err)
)
