// Sentry init — required FIRST (before express) so auto-instrumentation hooks in.
// No-op until SENTRY_DSN is set, so it's safe to deploy before you create the project.
const Sentry = require('@sentry/node')

if (process.env.SENTRY_DSN) {
	Sentry.init({
		dsn: process.env.SENTRY_DSN,
		environment: process.env.NODE_ENV || 'development',
		release: process.env.FLY_MACHINE_VERSION || process.env.RELEASE || undefined,
		sendDefaultPii: false,   // don't ship IPs / cookies / user data by default
		tracesSampleRate: 0,     // errors only for now (turn up for perf tracing later)
		beforeSend(event) {
			// Belt-and-suspenders: never let credentials leave the server.
			const d = event.request && event.request.data
			if (d && d.credentials) {
				if (d.credentials.password) d.credentials.password = '[redacted]'
				if (d.credentials.password_confirmation) d.credentials.password_confirmation = '[redacted]'
			}
			if (d && d.passwords) d.passwords = '[redacted]'
			if (event.request && event.request.headers) delete event.request.headers.authorization
			return event
		},
	})
	console.log('[sentry] error tracking enabled')
}

module.exports = Sentry
