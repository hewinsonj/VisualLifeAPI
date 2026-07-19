const express = require('express')
const passport = require('passport')

const InviteCode = require('../models/invite_code')
const User = require('../models/user')
const requireAdmin = require('../../lib/require_admin')

const requireToken = passport.authenticate('bearer', { session: false })
const admin = [requireToken, requireAdmin]
const router = express.Router()

// Only non-sensitive fields for the dashboard — never tokens / hashes.
const USER_FIELDS = 'email firstName lastInitial isAdmin corridorAccess subscriptionStatus createdAt'

// POST /admin/invites — mint an invite code
// body: { note?, maxUses?, expiresInDays? }
router.post('/admin/invites', admin, async (req, res, next) => {
	try {
		const { note = '', maxUses = 1, expiresInDays } = req.body || {}
		const doc = {
			note: String(note).slice(0, 80),
			maxUses: Math.max(1, parseInt(maxUses, 10) || 1),
			createdBy: req.user.id,
		}
		const days = parseInt(expiresInDays, 10)
		if (days > 0) doc.expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
		const invite = await InviteCode.create(doc)
		res.status(201).json({ invite: withStatus(invite) })
	} catch (err) { next(err) }
})

// GET /admin/invites — list recent codes (newest first)
router.get('/admin/invites', admin, async (req, res, next) => {
	try {
		const invites = await InviteCode.find().sort({ createdAt: -1 }).limit(100)
		res.json({ invites: invites.map(withStatus) })
	} catch (err) { next(err) }
})

// POST /admin/invites/:id/revoke — disable a code
router.post('/admin/invites/:id/revoke', admin, async (req, res, next) => {
	try {
		const invite = await InviteCode.findById(req.params.id)
		if (!invite) return res.status(404).json({ error: 'Not found' })
		invite.revoked = true
		await invite.save()
		res.json({ invite: withStatus(invite) })
	} catch (err) { next(err) }
})

// GET /admin/users — list accounts for the dashboard (newest first). Supports ?q= to
// filter by email/name so a long list stays manageable.
router.get('/admin/users', admin, async (req, res, next) => {
	try {
		const q = String((req.query.q || '')).trim()
		const filter = q ? { $or: [
			{ email:     { $regex: q, $options: 'i' } },
			{ firstName: { $regex: q, $options: 'i' } },
		] } : {}
		const users = await User.find(filter).select(USER_FIELDS).sort({ createdAt: -1 }).limit(200)
		res.json({ users })
	} catch (err) { next(err) }
})

// PATCH /admin/users/:id/corridor — grant or revoke Corridor access. body: { access: bool }
router.patch('/admin/users/:id/corridor', admin, async (req, res, next) => {
	try {
		const access = !!(req.body || {}).access
		const user = await User.findByIdAndUpdate(
			req.params.id,
			{ corridorAccess: access },
			{ new: true },
		).select(USER_FIELDS)
		if (!user) return res.status(404).json({ error: 'Not found' })
		res.json({ user })
	} catch (err) { next(err) }
})

function withStatus(doc) {
	return { ...doc.toObject(), status: doc.status() }
}

module.exports = router
