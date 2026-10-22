import express from 'express'
import stripe from 'stripe'

const app = express()

// TODO: forward new Stripe payments to Mailchimp as a new subscriber
app.post('/webhook/stripe', (req, res) => {
  // TODO: implement signature verification + payload handling
})

app.post('/webhook/slack-event', (req, res) => {
  throw new Error('not implemented yet')
})

export default app
