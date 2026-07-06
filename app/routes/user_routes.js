const express = require('express')
const crypto = require('crypto')
const passport = require('passport')
const bcrypt = require('bcrypt')

const errors = require('../../lib/custom_errors')
const User = require('../models/user')

const bcryptSaltRounds = 10
const requireToken = passport.authenticate('bearer', { session: false })
const router = express.Router()

// POST /sign-up
router.post('/sign-up', (req, res, next) => {
	Promise.resolve(req.body.credentials)
		.then((credentials) => {
			if (
				!credentials ||
				!credentials.password ||
				credentials.password !== credentials.password_confirmation
			) {
				throw new errors.BadParamsError()
			}
		})
		.then(() => bcrypt.hash(req.body.credentials.password, bcryptSaltRounds))
		.then((hash) => ({
			email: req.body.credentials.email,
			hashedPassword: hash,
			firstName: req.body.credentials.firstName || '',
			lastInitial: req.body.credentials.lastInitial || '',
		}))
		.then((user) => User.create(user))
		.then((user) => res.status(201).json({ user: user.toObject() }))
		.catch(next)
})

// POST /sign-in
router.post('/sign-in', (req, res, next) => {
	const pw = req.body.credentials.password
	let user

	User.findOne({ email: req.body.credentials.email })
		.then((record) => {
			if (!record) throw new errors.BadCredentialsError()
			user = record
			return bcrypt.compare(pw, user.hashedPassword)
		})
		.then((correctPassword) => {
			if (!correctPassword) throw new errors.BadCredentialsError()
			user.token = crypto.randomBytes(16).toString('hex')
			return user.save()
		})
		.then((user) => res.status(200).json({ user: user.toObject() }))
		.catch(next)
})

// DELETE /sign-out
router.delete('/sign-out', requireToken, (req, res, next) => {
	req.user.token = crypto.randomBytes(16).toString('hex')
	req.user.save()
		.then(() => res.sendStatus(204))
		.catch(next)
})

// PATCH /change-password
router.patch('/change-password', requireToken, (req, res, next) => {
	let user
	User.findById(req.user.id)
		.then((record) => { user = record })
		.then(() => bcrypt.compare(req.body.passwords.old, user.hashedPassword))
		.then((correctPassword) => {
			if (!req.body.passwords.new || !correctPassword) throw new errors.BadParamsError()
		})
		.then(() => bcrypt.hash(req.body.passwords.new, bcryptSaltRounds))
		.then((hash) => {
			user.hashedPassword = hash
			return user.save()
		})
		.then(() => res.sendStatus(204))
		.catch(next)
})

// GET /me — return current user's public info including subscription status
router.get('/me', requireToken, (req, res, next) => {
	User.findById(req.user.id)
		.then((user) => res.json({ user: user.toObject() }))
		.catch(next)
})

// PATCH /profile — set the user's first name + last initial (collected post-login)
router.patch('/profile', requireToken, (req, res, next) => {
	const { firstName, lastInitial } = req.body.profile || {}
	User.findById(req.user.id)
		.then((user) => {
			if (firstName !== undefined) user.firstName = firstName
			if (lastInitial !== undefined) user.lastInitial = lastInitial
			return user.save()
		})
		.then((user) => res.json({ user: user.toObject() }))
		.catch(next)
})

// GET /settings — return user's synced settings (keybinds, ctrlBinds, etc.)
router.get('/settings', requireToken, (req, res, next) => {
	User.findById(req.user.id)
		.then((user) => res.json({ settings: user.settings || {} }))
		.catch(next)
})

// PATCH /settings — shallow-merge top-level keys into user settings
router.patch('/settings', requireToken, (req, res, next) => {
	User.findById(req.user.id)
		.then((user) => {
			user.settings = { ...(user.settings || {}), ...req.body.settings }
			user.markModified('settings')
			return user.save()
		})
		.then((user) => res.json({ settings: user.settings }))
		.catch(next)
})

module.exports = router
