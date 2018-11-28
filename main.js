const Twitter = require('twitter')
const request = require('request-promise')
const base64Img = require('base64-img')
const fs = require('fs')
const Promise = require('bluebird')
const db = require('node-persist')
const bigInt = require('big-integer')

const EMULATOR_URL = process.env.EMULATOR_URL || 'http://localhost:8123'

const DELAY = 10e3

const VALID_MOVES = [ 'a', 'b', 'up', 'down', 'left', 'right', 'start', 'select' ]

let moves = {}

const resetPoll = moves => VALID_MOVES.forEach(item => (moves[item] = 0))

const client = new Twitter({
  consumer_key: process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
  access_token_key: process.env.TWITTER_ACCESS_TOKEN_KEY,
  access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET
})

const runEmulator = (method, params = {}) => {
  const url = `${EMULATOR_URL}/${method}`

  if (!Object.keys(params).length) return request(url)

  const fragments = Object.keys(params).map(key => {
    const value = params[key]
    return `${key}=${value}`
  })

  const append = `?${fragments.join('&')}`

  return request(`${url}${append}`)
}

const tweet = async (data = {}) => {
  const imageBase64 = `data:image/png;base64,${data.image}`
  const imagePath = base64Img.imgSync(imageBase64, '', 'tmp-img')
  const image = fs.readFileSync(imagePath)

  const media = await client.post('media/upload', { media: image })

  const status = {
    status: '@WePlayBot ' + data.text,
    media_ids: media.media_id_string,
    in_reply_to_status_id: data.in_reply_to_status_id
  }
  return client.post('statuses/update', status)
}

const run = async () => {
  await db.init({
    dir: '.persistence',
    logging: false
  })
  resetPoll(moves)
  const gameStarted = await db.getItem('gameStarted')
  if (gameStarted === 'yes') {
    // TODO
  } else {
    // new game
    const startData = JSON.parse(await runEmulator('start'))
    const lastTweet = await db.getItem('lastTweet')
    await Promise.all([
      tweet({
        text: 'Aaaaand the game begins... Pick the first button to press (a, b, up, down, left, right, select, start)',
        image: startData.result.screenshot,
        in_reply_to_status_id: lastTweet
      }).then(status => {
        db.setItem('lastTweet', status.id_str)
      }).catch(console.error),
      Promise.delay(DELAY)
    ])
    db.setItem('gameStarted', 'yes')
  }
  return turn(moves)
}

const stream = client.stream('statuses/filter', {track: '@WePlayBot'})
stream.on('data', async event => {
  const lastTweet = bigInt(await db.getItem('lastTweet'))
  const replyTweet = bigInt(event.in_reply_to_status_id)
  if (event.in_reply_to_user_id === 4614087921 && lastTweet.compare(replyTweet)) {
    const cleanTweet = event.text.toLowerCase().replace('@weplaybot', '').trim().split(' ')
    const move = VALID_MOVES.find(validMove => {
      return cleanTweet.includes(validMove)
    })
    if (move) {
      moves[move] += 1
    }
  }
})
stream.on('error', error => {
  console.error(error)
})

const getNextMove = async (moves) => {
  let result = 0
  let winner = 'nothing'
  Object.keys(moves).forEach(move => {
    if (moves[move] > result) {
      result = moves[move]
      winner = move
    }
  })
  console.log("Moves: ", moves)
  console.log("Winner: ", winner)
  resetPoll(moves)
  return winner
}

const turn = async (moves) => {
  console.log('moves for this turn:')
  console.log(stream) 
  console.log(moves)

  const nextMove = await getNextMove(moves)
  console.log(nextMove)
  if (nextMove === 'nothing') return Promise.delay(DELAY).then(() => turn(moves))

  const aData = JSON.parse(await runEmulator('execute', { key: nextMove }))
  const lastTweet = await db.getItem('lastTweet')
  await Promise.all([
    tweet({
      text: 'This is the result of the last move. Pick the next button to press (a, b, up, down, left, right, select, start)',
      image: aData.result.screenshot,
      in_reply_to_status_id: lastTweet
    }).then(status => {
      db.setItem('lastTweet', status.id_str)
    }).catch(console.error),
    Promise.delay(DELAY)
  ])
  turn(moves)
}

run().catch(console.error)
