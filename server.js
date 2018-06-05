let express = require('express')
let cors = require('cors')
let request = require('request')
let querystring = require('querystring')
let fetch = require('node-fetch')

let app = express()

let whitelist = ['http://localhost:8888', 'https://rasphub.herokuapp.com']
let corsOptionsDelegate = function (req, callback) {
  let corsOptions;
  if (whitelist.indexOf(req.header('Origin')) !== -1) {
    corsOptions = { origin: true } // reflect (enable) the requested origin in the CORS response
  }else{
    corsOptions = { origin: false } // disable CORS for this request
  }
  callback(null, corsOptions) // callback expects two parameters: error and options
}
app.use(cors())
app.set('json spaces', 2)

Date.prototype.addDays = function(days) {
  let result = new Date(this);
  result.setDate(result.getDate() + days);
  return result;
}

Date.prototype.format = function() {
  return (this.getFullYear() + '-' + (this.getMonth() + 1) + '-' + this.getDate())
}

let date = new Date()


function handleErrors(response) {
  if (!response.ok) {
    throw Error(response.statusText)
  }
  return response;
}

let tmdbImage = (tmdbId) => {
  let apikey = process.env.TMDB_API_KEY,
      fetchUrl = 'https://api.themoviedb.org/3/movie/' + tmdbId + '/images?api_key=' + apikey

  return fetch(fetchUrl, {
    method: 'GET'
  })
  .then(response => response.json())
  .then(tmdbImages => {
    return ("http://image.tmdb.org/t/p/w342" + tmdbImages.posters[0].file_path)
  })
  .catch(err => console.log(err))
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
    let access_token = body.access_token
    let uri = process.env.FRONTEND_URI || 'http://localhost:3000'
    res.redirect(uri + '?access_token=' + access_token)
  })
})


app.get('/seriescalendar', function(req, res) {
  let calendar = [],
      apikey = process.env.SONARR_API_KEY,
      fetchUrl = 'http://sonarr.gladosplex.nl/api/calendar?apikey=' + apikey  + '&start=' + date.format() + '&end=' + date.addDays(7).format()

  function getSonarrCalendar(apikey) {
    fetch(fetchUrl,
    {
      method: 'GET',
      headers: {
        Accept: 'application/json'
      }
    })
    .then(responseClone => responseClone.json())
    .then(sonarrCalendarPromise => {

        sonarrCalendarPromise = sonarrCalendarPromise || []

        sonarrCalendarPromise.forEach(item => {
          calendar.push(item)
        })

        res.contentType('application/json')
        res.json(calendar)
      }
    )
    .catch(error => console.log(error))
  }

  getSonarrCalendar(apikey)
})

app.get('/moviecalendar', function(req, res) {
  let calendar = [],
      apikey = process.env.RADARR_API_KEY

  function getRadarrCalendar(apikey) {
    fetch('http://radarr.gladosplex.nl/api/calendar?apikey=' + apikey + '&start=' + date.format() + '&end=' + date.addDays(120).format(),
    {
      method: 'GET',
      headers: {
        Accept: 'application/json'
      }
    })
    .then(response => response.json())
    .then(radarrCalendar => {
        radarrCalendar = radarrCalendar.slice(0,7) || []

        let calendar = Promise.all(radarrCalendar.map(movie => {
          return tmdbImage(movie.tmdbId)
          .then(imageUrl => {
            let movieObj = Object.assign({}, movie)
            movieObj.tmdbPoster = imageUrl
            return movieObj
          })
        }))
        .then(result => {
          res.contentType('application/json')
          res.json(result)
        })
        .catch(err => {
          console.log(err)
        })
      }
    )
    .catch(error => console.log(error))
  }

  getRadarrCalendar(apikey)
})

let port = process.env.PORT || 8888
console.log(`Listening on port ${port}.`)
app.listen(port)
