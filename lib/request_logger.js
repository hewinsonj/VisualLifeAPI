// Redact secrets before logging. Request bodies carry plaintext passwords and reset
// tokens (sign-in, sign-up, change-password, reset-password); those must never hit the
// logs. Any key matching the pattern (e.g. password, password_confirmation, passwords,
// token) is replaced with a placeholder; everything else is logged as-is for debugging.
const SENSITIVE = /pass|token|secret|otp|authorization/i

function redact(val) {
	if (Array.isArray(val)) return val.map(redact)
	if (val && typeof val === 'object') {
		const out = {}
		for (const [k, v] of Object.entries(val)) {
			out[k] = SENSITIVE.test(k) ? '[redacted]' : redact(v)
		}
		return out
	}
	return val
}

module.exports = (req, res, next) => {
	console.log('\n===== Incoming Request =====')
	console.log(`${new Date()}`)
	console.log(`${req.method} ${req.url}`)
	if (Object.keys(req.body || {}).length) console.log(`body ${JSON.stringify(redact(req.body))}`)
	console.log('============================\n')
	next()
}
