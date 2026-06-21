require('dotenv').config()

const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')

const db = require('./config/db')
const auth = require('./lib/auth')
const errorHandler = require('./lib/error_handler')
const replaceToken = require('./lib/replace_token')
const requestLogger = require('./lib/request_logger')
const removeBlankFields = require('./lib/remove_blank_fields')

const userRoutes = require('./app/routes/user_routes')
const presetRoutes = require('./app/routes/preset_routes')
const stripeRoutes = require('./app/routes/stripe_routes')

mongoose.connect(db)
	.then(() => console.log('MongoDB connected:', db))
	.catch((err) => console.error('MongoDB connection error:', err))

const app = express()
const port = process.env.PORT || 8000
const clientDevPort = 5173

app.use(cors({
	origin: process.env.CLIENT_ORIGIN || `http://localhost:${clientDevPort}`,
}))

// Stripe webhook must receive raw body — mount BEFORE express.json()
app.use('/stripe/webhook', stripeRoutes)

app.use(replaceToken)
app.use(auth)
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(removeBlankFields)
app.use(requestLogger)

app.use(userRoutes)
app.use(presetRoutes)
// Non-webhook stripe routes (e.g. POST /subscribe) after json parsing
app.use(stripeRoutes)

app.use(errorHandler)

app.listen(port, () => console.log(`Visual Life API listening on port ${port}`))

module.exports = app
