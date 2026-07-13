const express = require('express')
const passport = require('passport')

const InviteCode = require('../models/invite_code')
const requireAdmin = require('../../lib/require_admin')

const requireToken = passport.authenticate('bearer', { session: false })
const admin = [requireToken, requireAdmin]
const router = express.Router()

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

function withStatus(doc) {
	return { ...doc.toObject(), status: doc.status() }
}

module.exports = router
