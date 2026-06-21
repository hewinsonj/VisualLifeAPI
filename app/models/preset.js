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
		isPublic: {
			type: Boolean,
			default: false,
		},
	},
	{ timestamps: true }
)

module.exports = mongoose.model('Preset', presetSchema)
