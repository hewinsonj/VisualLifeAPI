const mongoose = require('mongoose')

const presetSchema = new mongoose.Schema(
	{
		owner: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
			required: true,
		},
		name: {
			type: String,
			required: true,
			trim: true,
			maxlength: 64,
		},
		// Ordered list of active effect keys, e.g. ['chromaPulse', 'duotone']
		patchOrder: {
			type: [String],
			default: [],
		},
		// Map of effectKey → { paramKey: value } for every effect in patchOrder
		params: {
			type: mongoose.Schema.Types.Mixed,
			default: {},
		},
		// Camera position/orientation/mode snapshot
		camera: {
			type: mongoose.Schema.Types.Mixed,
			default: null,
		},
		// Global scene state: colors/palette, layer visibility, brightness, looks, etc.
		global: {
			type: mongoose.Schema.Types.Mixed,
			default: {},
		},
		// World-specific state (lava, skull, plant count, seasons, etc.)
		worldState: {
			type: mongoose.Schema.Types.Mixed,
			default: null,
		},
		scene: {
			type: String,
			enum: ['geogalaxy', 'jzone', '70room', 'corridor'],
			default: 'geogalaxy',
		},
		isPublic: {
			type: Boolean,
			default: false,
		},
	},
	{ timestamps: true }
)

// Indexes for the hot queries: list/count a user's presets by owner, and the
// public gallery filtered by isPublic + sorted newest-first.
presetSchema.index({ owner: 1 })
presetSchema.index({ isPublic: 1, createdAt: -1 })

module.exports = mongoose.model('Preset', presetSchema)
