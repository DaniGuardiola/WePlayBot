const Twitter = require('twitter')
const request = require('request-promise')
const base64Img = require('base64-img')
const fs = require('fs')
const Promise = require('bluebird')
const bigInt = require('big-integer')

const EMULATOR_URL = process.env.EMULATOR_URL || 'http://localhost:8123'

const DELAY = 30e3

let LAST_MENTION_ID = 706829683887837200

const VALID_MOVES = [ 'a', 'b', 'up', 'down', 'left', 'right', 'start', 'select' ]

let moves = {}
const resetPoll = (moves) => {VALID_MOVES.forEach(item => moves[item] = 0)}

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
  console.log(media)

  const status = {
    status: data.text,
    media_ids: media.media_id_string
  }

  return client.post('statuses/update', status)
}

const run = async () => {
  resetPoll(moves)
  if (true) {
    // TODO
  }
  else {
    // new game
    const startData = JSON.parse(await runEmulator('start'))
    await Promise.all([tweet({
      text: 'Aaaaand the game begins... Pick the first button to press (a, b, up, down, left, right, select, start)',
      image: startData.result.screenshot
    }).catch(console.error),
    Promise.delay(DELAY)])
  }
  return turn(moves)
}

const stream = client.stream('statuses/filter', {track: '@WePlayBot'})
stream.on('data', event => {
  if (event.in_reply_to_user_id == "4614087921"){
    console.log("event: "+event)
    console.log("text: "+event.text)
    const move = event.text.toLowerCase().replace('@weplaybot', '').trim()
    console.log("moves2times")
    console.log(moves)
    if (VALID_MOVES.indexOf(move) > -1)
      moves[move] += 1
    console.log(moves)
  }
})
stream.on('error', error => {
  console.error(error)
})

const winnerMove = async (moves) => {
  var result = 0
  var winner = 'nothing'
  console.log("win")
  console.log(moves)
  Object.keys(moves).forEach(move => {
    if (moves[move] > result){
      result = moves[move]
      winner = move
    }
  })
  resetPoll(moves)
  return winner
}

const turn = async (moves) => {
  console.log(moves)
  const nextMove = await winnerMove(moves)
  if (nextMove == 'nothing') return Promise.delay(DELAY).then(() => turn(moves))
  const aData = JSON.parse(await runEmulator('execute', { key: nextMove }))
  await Promise.all([
    tweet({
      text: 'This is the result of the last move. Pick the next button to press (a, b, up, down, left, right, select, start)',
      image: aData.result.screenshot
    }).catch(console.error),
    Promise.delay(DELAY)
  ])
  turn(moves)
}



// const getNextMove = async () => {
//   console.log('before')
//   console.log('last mention id', LAST_MENTION_ID)
//   const mentions = await client.get('statuses/mentions_timeline', {
//     since_id: LAST_MENTION_ID
//   })
//   const lastMention = mentions.find(x => {
//     const text = x.text.toLowerCase().replace('@weplaybot', '').trim()
//     return VALID_MOVES.indexOf(text) > -1
//   })
//   // console.log(mentions)
//   console.log('after')
//   // console.log(lastMention)
//   if (lastMention) LAST_MENTION_ID = bigInt(lastMention.id_str).add(1).toString()
//   else return false
//
//   return lastMention.text.toLowerCase().replace('@weplaybot', '').trim()
// }

run().catch(console.error)
