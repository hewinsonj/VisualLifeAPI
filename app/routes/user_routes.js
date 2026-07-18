const express = require('express')
const crypto = require('crypto')
const passport = require('passport')
const bcrypt = require('bcrypt')

const errors = require('../../lib/custom_errors')
const User = require('../models/user')
const InviteCode = require('../models/invite_code')
const { sendWelcomeEmail, sendPasswordResetEmail } = require('../../lib/email')

// Where the emailed reset link points — first CLIENT_ORIGIN (prod), else localhost dev.
const clientBase = () => (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',')[0].trim().replace(/\/$/, '')
const sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex')
const RESET_TTL_MS = 60 * 60 * 1000 // 1 hour

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
			// Multi-session: add a token for this device, keeping other devices'
			// tokens (and migrating any pre-existing single token into the set).
			const newToken = crypto.randomBytes(16).toString('hex')
			const set = new Set(user.tokens || [])
			if (user.token) set.add(user.token)
			set.add(newToken)
			user.tokens = [...set].slice(-10)   // cap: 10 most recent sessions
			user.token = newToken               // returned to this client + legacy fallback
			return user.save()
		})
		.then((user) => res.status(200).json({ user: user.toObject() }))
		.catch(next)
})

// DELETE /sign-out
router.delete('/sign-out', requireToken, (req, res, next) => {
	// Log out only this device: drop its token, leave other sessions intact.
	const tok = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
	req.user.tokens = (req.user.tokens || []).filter((t) => t !== tok)
	if (req.user.token === tok) req.user.token = crypto.randomBytes(16).toString('hex')
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
			// Password change invalidates all other sessions; keep only this device.
			const tok = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
			user.tokens = tok ? [tok] : []
			user.token = tok || ''
			return user.save()
		})
		.then(() => res.sendStatus(204))
		.catch(next)
})

// POST /forgot-password — email a reset link. Always returns the same 200 whether or not
// the address has an account, so it can't be used to discover which emails are registered.
router.post('/forgot-password', async (req, res, next) => {
	try {
		const email = String((req.body || {}).email || '').trim().toLowerCase()
		const generic = { message: 'If an account exists for that email, a reset link is on its way.' }
		if (!email) return res.status(200).json(generic)

		const user = await User.findOne({ email })
		if (user) {
			const token = crypto.randomBytes(32).toString('hex')   // emailed to the user
			user.resetPasswordTokenHash = sha256(token)            // only the hash is stored
			user.resetPasswordExpires = new Date(Date.now() + RESET_TTL_MS)
			await user.save()
			const resetUrl = `${clientBase()}/reset-password?token=${token}`
			// Fire-and-forget — don't block the response or reveal send failures to the client.
			sendPasswordResetEmail(user.email, user.firstName, resetUrl)
		}
		return res.status(200).json(generic)
	} catch (err) {
		next(err)
	}
})

// POST /reset-password — consume a token, set a new password, sign every session out.
router.post('/reset-password', async (req, res, next) => {
	try {
		const { token, password, password_confirmation } = req.body || {}
		if (!token || !password || password !== password_confirmation) {
			return res.status(422).json({ error: 'A valid token and matching passwords are required' })
		}
		const user = await User.findOne({
			resetPasswordTokenHash: sha256(String(token)),
			resetPasswordExpires: { $gt: new Date() },
		})
		if (!user) {
			return res.status(400).json({ error: 'This reset link is invalid or has expired. Request a new one.' })
		}
		user.hashedPassword = await bcrypt.hash(password, bcryptSaltRounds)
		user.resetPasswordTokenHash = null
		user.resetPasswordExpires = null
		// Reset invalidates every existing session — the user signs in fresh afterward.
		user.tokens = []
		user.token = ''
		await user.save()
		return res.sendStatus(204)
	} catch (err) {
		next(err)
	}
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
