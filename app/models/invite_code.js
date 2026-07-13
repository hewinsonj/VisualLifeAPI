const mongoose = require('mongoose')

// Short, unambiguous codes (no 0/O/1/I) — easy to read off a phone / QR.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function genCode() {
	let c = ''
	for (let i = 0; i < 8; i++) c += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
	return c
}

const inviteCodeSchema = new mongoose.Schema(
	{
		code:      { type: String, required: true, unique: true, uppercase: true, default: genCode },
		note:      { type: String, trim: true, maxlength: 80, default: '' },
		maxUses:   { type: Number, default: 1, min: 1 },
		uses:      { type: Number, default: 0 },
		expiresAt: { type: Date, default: null },
		revoked:   { type: Boolean, default: false },
		createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
		usedBy:    [{ email: String, at: Date }],
	},
	{ timestamps: true }
)

inviteCodeSchema.methods.isUsable = function () {
	if (this.revoked) return false
	if (this.expiresAt && new Date() > this.expiresAt) return false
	if (this.uses >= this.maxUses) return false
	return true
}

inviteCodeSchema.methods.status = function () {
	if (this.revoked) return 'revoked'
	if (this.expiresAt && new Date() > this.expiresAt) return 'expired'
	if (this.uses >= this.maxUses) return 'used'
	return 'active'
}

module.exports = mongoose.model('InviteCode', inviteCodeSchema)
