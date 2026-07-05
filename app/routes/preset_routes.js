const express = require('express')
const passport = require('passport')

const errors = require('../../lib/custom_errors')
const Preset = require('../models/preset')

const requireToken = passport.authenticate('bearer', { session: false })
const router = express.Router()

const TRIAL_PRESET_LIMIT = parseInt(process.env.TRIAL_PRESET_LIMIT || '5', 10)

// Middleware: user must be subscribed (active or in-trial) to write presets
const requireSubscription = (req, res, next) => {
	if (!req.user.isSubscribed()) {
		return next(new errors.SubscriptionError('Your trial has ended. Subscribe to save presets.'))
	}
	next()
}

// GET /presets — all presets owned by the current user
router.get('/presets', requireToken, (req, res, next) => {
	Preset.find({ owner: req.user.id })
		.sort({ updatedAt: -1 })
		.then((presets) => res.json({ presets }))
		.catch(next)
})

// GET /presets/public — publicly shared presets from all users
router.get('/presets/public', (req, res, next) => {
	Preset.find({ isPublic: true })
		.populate('owner', 'email')
		.sort({ updatedAt: -1 })
		.limit(100)
		.then((presets) => res.json({ presets }))
		.catch(next)
})

// GET /presets/:id — single preset (must be owner or public)
router.get('/presets/:id', requireToken, (req, res, next) => {
	Preset.findById(req.params.id)
		.then(errors.handle404)
		.then((preset) => {
			if (!preset.isPublic && !preset.owner.equals(req.user.id)) {
				throw new errors.OwnershipError()
			}
			res.json({ preset })
		})
		.catch(next)
})

// POST /presets — create a new preset
router.post('/presets', requireToken, requireSubscription, (req, res, next) => {
	const { name, patchOrder, params, camera, global, worldState, scene, isPublic } = req.body.preset

	// Enforce trial save limit
	const checkLimit = () => {
		if (req.user.subscriptionStatus !== 'trial') return Promise.resolve()
		return Preset.countDocuments({ owner: req.user.id }).then((count) => {
			if (count >= TRIAL_PRESET_LIMIT) {
				throw new errors.SubscriptionError(
					`Trial accounts are limited to ${TRIAL_PRESET_LIMIT} presets. Subscribe to save more.`
				)
			}
		})
	}

	checkLimit()
		.then(() =>
			Preset.create({
				owner: req.user.id,
				name,
				patchOrder: patchOrder || [],
				params: params || {},
				camera: camera ?? null,
				global: global || {},
				worldState: worldState ?? null,
				scene: scene || 'geogalaxy',
				isPublic: !!isPublic,
			})
		)
		.then((preset) => res.status(201).json({ preset }))
		.catch(next)
})

// PATCH /presets/:id — update name, params, or isPublic
router.patch('/presets/:id', requireToken, requireSubscription, (req, res, next) => {
	Preset.findById(req.params.id)
		.then(errors.handle404)
		.then((preset) => {
			errors.requireOwnership(req, preset)
			const { name, patchOrder, params, camera, global, worldState, scene, isPublic } = req.body.preset || {}
			if (name !== undefined) preset.name = name
			if (patchOrder !== undefined) preset.patchOrder = patchOrder
			if (params !== undefined) preset.params = params
			if (camera !== undefined) { preset.camera = camera; preset.markModified('camera') }
			if (global !== undefined) { preset.global = global; preset.markModified('global') }
			if (worldState !== undefined) { preset.worldState = worldState; preset.markModified('worldState') }
			if (scene !== undefined) preset.scene = scene
			if (isPublic !== undefined) preset.isPublic = isPublic
			return preset.save()
		})
		.then((preset) => res.json({ preset }))
		.catch(next)
})

// DELETE /presets/:id
router.delete('/presets/:id', requireToken, (req, res, next) => {
	Preset.findById(req.params.id)
		.then(errors.handle404)
		.then((preset) => {
			errors.requireOwnership(req, preset)
			return preset.deleteOne()
		})
		.then(() => res.sendStatus(204))
		.catch(next)
})

module.exports = router
