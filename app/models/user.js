const mongoose = require('mongoose')

const TRIAL_DAYS = parseInt(process.env.TRIAL_DAYS || '14', 10)

const userSchema = new mongoose.Schema(
	{
		email: {
			type: String,
			required: true,
			unique: true,
		},
		hashedPassword: {
			type: String,
			required: true,
		},
		token: String,

		// Who's using it — collected at sign-up so we can reach beta users
		// (e.g. send their login for the first non-beta release).
		firstName: {
			type: String,
			trim: true,
			maxlength: 40,
			default: '',
		},
		lastInitial: {
			type: String,
			trim: true,
			maxlength: 2,
			uppercase: true,
			default: '',
		},

		// Subscription
		subscriptionStatus: {
			type: String,
			enum: ['trial', 'active', 'canceled', 'none'],
			default: 'trial',
		},
		trialEndsAt: {
			type: Date,
			default: () => new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000),
		},
		stripeCustomerId: {
			type: String,
			default: null,
		},
		stripeSubscriptionId: {
			type: String,
			default: null,
		},
		settings: {
			type: mongoose.Schema.Types.Mixed,
			default: {},
		},
	},
	{
		timestamps: true,
		toObject: {
			transform: (_doc, user) => {
				delete user.hashedPassword
				return user
			},
		},
	}
)

// Returns true if the user can save presets right now
userSchema.methods.isSubscribed = function () {
	if (this.subscriptionStatus === 'active') return true
	if (this.subscriptionStatus === 'trial' && new Date() < this.trialEndsAt) return true
	return false
}

module.exports = mongoose.model('User', userSchema)
