const passport = require('passport')
const bearer = require('passport-http-bearer')
const User = require('../app/models/user')

const strategy = new bearer.Strategy(function (token, done) {
	// Match any active session token; fall back to the legacy single `token`
	// field for sessions created before multi-session existed.
	User.findOne({ $or: [{ tokens: token }, { token: token }] })
		.then((user) => done(null, user, { scope: 'all' }))
		.catch((err) => done(err))
})

passport.serializeUser((user, done) => done(null, user))
passport.deserializeUser((user, done) => done(null, user))

passport.use(strategy)

module.exports = passport.initialize()
