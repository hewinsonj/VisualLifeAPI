const rateLimit = require('express-rate-limit')

const WINDOW = 15 * 60 * 1000 // 15 minutes

const make = (limit, text) =>
	rateLimit({
		windowMs: WINDOW,
		limit,
		standardHeaders: 'draft-7',
		legacyHeaders: false,
		message: { error: text },
	})

// Broad safety net across all normal API traffic.
const globalLimiter = make(300, 'Too many requests — slow down and try again shortly.')

// Tight cap on credential endpoints (brute-force / signup abuse).
const authLimiter = make(25, 'Too many attempts — wait a few minutes and try again.')

// Unauthenticated public browsing.
const publicLimiter = make(60, 'Too many requests — try again shortly.')

module.exports = { globalLimiter, authLimiter, publicLimiter }
