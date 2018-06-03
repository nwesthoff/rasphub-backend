let express = require('express')
let request = require('request')
let querystring = require('querystring')
let fetch = require('node-fetch')

let app = express()

app.set('json spaces', 2)

function handleErrors(response) {
  if (!response.ok) {
    throw Error(response.statusText)
  }
  return response;
}

let redirect_uri =
  process.env.REDIRECT_URI ||
  'http://localhost:8888/callback'

app.get('/login', function(req, res) {
  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: process.env.SPOTIFY_CLIENT_ID,
      scope: 'user-read-private user-read-email user-read-playback-state user-read-recently-played',
      redirect_uri
    }))
})

app.get('/callback', function(req, res) {
  let code = req.query.code || null
  let authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    form: {
      code: code,
      redirect_uri,
      grant_type: 'authorization_code'
    },
    headers: {
      'Authorization': 'Basic ' + (new Buffer(
        process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET
      ).toString('base64'))
    },
    json: true
  }
  request.post(authOptions, function(error, response, body) {
    var access_token = body.access_token
    let uri = process.env.FRONTEND_URI || 'http://localhost:3000'
    res.redirect(uri + '?access_token=' + access_token)
  })
})


app.get('/calendar', function(req, res) {
  let calendar = [],
      apikey = process.env.SONARR_API_KEY

  function getSonarrCalendar(apikey) {
    fetch('http://sonarr.gladosplex.nl/api/calendar?apikey=' + apikey,
    {
      method: 'GET',
      headers: {
        Accept: 'application/json'
      }
    })
    .then(response => {
      handleErrors(response)
      return response.clone()
    })
    .then(responseClone => responseClone.json())
    .then(sonarrCalendarPromise => {
        console.log("Calling up Sonarr to check schedule")

        sonarrCalendarPromise.forEach(item => {
          calendar.push(item)
        })

        res.contentType('application/json')
        res.json(calendar)

        console.log("Got a schedule from Sonarr, we can probably figure this out")
      }
    )
    .catch(error => console.log(error))
  }

  getSonarrCalendar(apikey)
})

let port = process.env.PORT || 8888
console.log(`Listening on port ${port}. Go /login to initiate authentication flow.`)
app.listen(port)
