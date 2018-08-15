const Twitter = require('twitter')
const request = require('request-promise')
const base64Img = require('base64-img')
const fs = require('fs')
const Promise = require('bluebird')

const EMULATOR_URL = process.env.EMULATOR_URL || 'http://localhost:8123'

const LAST_DATA = false // get persisted data if program was interrupted

let LAST_MENTION_ID = 706829683887837200

const VALID_MOVES = [ 'a', 'b', 'up', 'down', 'left', 'right', 'start', 'select' ]

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

  const media = await client.post('media/upload', {media: image})
  console.log(media)

  const status = {
    status: data.text,
    media_ids: media.media_id_string
  }

  return client.post('statuses/update', status)
}

const run = async () => {
  if (LAST_DATA) {
    // TODO
  } else {
    // new game
    const startData = JSON.parse(await runEmulator('start'))
    await tweet({
      text: 'Aaaaand the game begins... Pick the first button to press (a, b, up, down, left, right, select, start)',
      image: startData.result.screenshot
    }).catch(console.error)

    return turn()
  }
}

const turn = async () => {
  const nextMove = await getNextMove()
  if (!nextMove) return Promise.delay(10e3).then(turn)
  console.log(nextMove)
  const aData = JSON.parse(await runEmulator('execute', { key: nextMove }))
  await tweet({
    text: 'This is the result of the last move. Pick the next button to press (a, b, up, down, left, right, select, start)',
    image: aData.result.screenshot
  }).catch(console.error)
  return turn()
}

const getNextMove = async () => {
  console.log('before')
  const mentions = await client.get('statuses/mentions_timeline', {
    since_id: LAST_MENTION_ID
  })
  const lastMention = mentions.find(x => {
    const text = x.text.replace('@ElFavDeFieoner1', '').trim()
    return VALID_MOVES.indexOf(text) > -1
  })
  console.log(mentions)
  console.log('after')
  console.log(lastMention)
  if (lastMention) LAST_MENTION_ID = lastMention.id
  else return false

  return lastMention.text.replace('@ElFavDeFieoner1', '').trim()
}

run().catch(console.error)
