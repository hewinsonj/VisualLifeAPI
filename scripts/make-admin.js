// Promote an existing account to admin (so it can reach the /admin console).
// Usage:  node scripts/make-admin.js you@example.com
require('dotenv').config()
const mongoose = require('mongoose')
const db = require('../config/db')
const User = require('../app/models/user')

const email = process.argv[2]
if (!email) {
	console.error('Usage: node scripts/make-admin.js <email>')
	process.exit(1)
}

mongoose.connect(db)
	.then(() => User.findOneAndUpdate({ email }, { isAdmin: true }, { new: true }))
	.then((user) => {
		if (!user) console.error(`✗ No account found for ${email} — sign up first, then re-run.`)
		else console.log(`✓ ${user.email} is now an admin.`)
	})
	.catch((err) => { console.error(err) })
	.finally(() => mongoose.disconnect())
