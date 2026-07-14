const express = require('express')
const crypto = require('crypto')
const passport = require('passport')
const bcrypt = require('bcrypt')

const errors = require('../../lib/custom_errors')
const User = require('../models/user')
const InviteCode = require('../models/invite_code')
const { sendWelcomeEmail } = require('../../lib/email')

const bcryptSaltRounds = 10
const requireToken = passport.authenticate('bearer', { session: false })
const router = express.Router()

// POST /sign-up — requires a valid invite code unless SIGNUP_MODE=open
router.post('/sign-up', async (req, res, next) => {
	try {
		const creds = req.body.credentials || {}
		if (!creds.email || !creds.password || creds.password !== creds.password_confirmation) {
			return res.status(422).json({ error: 'Email and matching passwords are required' })
		}

		// Invite gate — the fly-by admin console mints these codes.
		let invite = null
		if (process.env.SIGNUP_MODE !== 'open') {
			const code = String(creds.inviteCode || '').trim().toUpperCase()
			invite = code ? await InviteCode.findOne({ code }) : null
			if (!invite || !invite.isUsable()) {
				return res.status(403).json({ error: 'Invalid or already-used invite code' })
			}
		}

		const hash = await bcrypt.hash(creds.password, bcryptSaltRounds)
		const user = await User.create({
			email: creds.email,
			hashedPassword: hash,
			firstName: creds.firstName || '',
			lastInitial: creds.lastInitial || '',
		})

		if (invite) {
			invite.uses += 1
			invite.usedBy.push({ email: user.email, at: new Date() })
			await invite.save()
		}

		// Welcome email — fire-and-forget so it never blocks or fails signup.
		sendWelcomeEmail(user.email, user.firstName)

		res.status(201).json({ user: user.toObject() })
	} catch (err) {
		// Duplicate email → friendly 422 instead of a raw Mongo error
		if (err && err.code === 11000) {
			return res.status(422).json({ error: 'An account with that email already exists' })
		}
		next(err)
	}
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
		.then((user) => {
			console.log(`[profile] saved name for ${user.email}: "${user.firstName}" "${user.lastInitial}"`)
			res.json({ user: user.toObject() })
		})
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
