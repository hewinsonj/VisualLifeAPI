require('dotenv').config()
const Sentry = require('./instrument') // must load before express for auto-instrumentation

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
const adminRoutes = require('./app/routes/admin_routes')
const { globalLimiter, authLimiter, publicLimiter } = require('./lib/rate_limits')

mongoose.connect(db)
	.then(() => console.log('MongoDB connected:', db))
	.catch((err) => console.error('MongoDB connection error:', err))

const app = express()
const port = process.env.PORT || 8000
const clientDevPort = 5173

// Behind Fly's proxy — trust the first hop so rate limiting sees the real client IP.
app.set('trust proxy', 1)

app.use(cors({
	origin: process.env.CLIENT_ORIGIN || `http://localhost:${clientDevPort}`,
}))

// Health check for uptime monitors + Fly — unauthenticated, never rate-limited.
// 200 when the DB is connected, 503 otherwise (so it reflects "can serve", not
// just "process alive").
app.get('/health', (req, res) => {
	const dbUp = mongoose.connection.readyState === 1
	res.status(dbUp ? 200 : 503).json({ ok: dbUp, db: dbUp ? 'up' : 'down', uptime: Math.round(process.uptime()) })
})

// Stripe webhook must receive raw body — mount BEFORE express.json() (and before
// the global limiter, so Stripe's retries are never throttled).
app.use('/stripe/webhook', stripeRoutes)

// Broad rate limit on everything else.
app.use(globalLimiter)

app.use(replaceToken)
app.use(auth)
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(removeBlankFields)
app.use(requestLogger)

// Tighter caps on abuse-prone endpoints (registered before their routes).
app.use(['/sign-in', '/sign-up', '/sign-out', '/change-password'], authLimiter)
app.use('/presets/public', publicLimiter)

app.use(userRoutes)
app.use(presetRoutes)
app.use(adminRoutes)
// Non-webhook stripe routes (e.g. POST /subscribe) after json parsing
app.use(stripeRoutes)

// Sentry captures route errors here (no-op until SENTRY_DSN is set), then the
// custom handler still formats the client response.
Sentry.setupExpressErrorHandler(app)

app.use(errorHandler)

app.listen(port, () => console.log(`Visual Life API listening on port ${port}`))

module.exports = app
