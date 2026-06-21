const passport = require('passport')
const bearer = require('passport-http-bearer')
const User = require('../app/models/user')

const strategy = new bearer.Strategy(function (token, done) {
	User.findOne({ token: token }, function (err, user) {
		if (err) return done(err)
		return done(null, user, { scope: 'all' })
	})
})

passport.serializeUser((user, done) => done(null, user))
passport.deserializeUser((user, done) => done(null, user))

passport.use(strategy)

module.exports = passport.initialize()
