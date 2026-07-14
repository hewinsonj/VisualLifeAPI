// Transactional email via Resend. No-op until RESEND_API_KEY is set, so it's
// safe to deploy before the email provider is configured (same pattern as the
// Sentry instrument). Configure with:
//   RESEND_API_KEY   — from resend.com (required to actually send)
//   EMAIL_FROM       — verified sender, e.g. "Visual Life <hello@yourdomain>"
//   EMAIL_REPLY_TO   — where replies land (defaults to the Proton support inbox)
const Sentry = require('../instrument')

const FROM     = process.env.EMAIL_FROM     || 'Visual Life <onboarding@resend.dev>'
const REPLY_TO = process.env.EMAIL_REPLY_TO || 'visuallife@proton.me'

let resend = null
if (process.env.RESEND_API_KEY) {
	const { Resend } = require('resend')
	resend = new Resend(process.env.RESEND_API_KEY)
	console.log('[email] Resend enabled')
}

function welcomeTemplate(firstName) {
	const name = (firstName || '').trim()
	const greeting = name ? `Hi ${name},` : 'Hi there,'
	const subject = 'Welcome to Visual Life 🌌'

	const text = [
		greeting,
		'',
		"Thanks for checking out Visual Life — I'm genuinely glad you're here.",
		'',
		"You're in early, so you're among the first to play with it. More worlds, effects,",
		'and controls are on the way — stay tuned for updates.',
		'',
		'Got thoughts, bugs, or ideas? Just reply to this email — it comes straight to me.',
		'',
		'Enjoy the visuals,',
		'— Visual Life',
	].join('\n')

	const html = `
	<div style="margin:0;padding:0;background:#0b0b0f;">
	  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b0b0f;padding:32px 0;">
	    <tr><td align="center">
	      <table role="presentation" width="480" cellpadding="0" cellspacing="0"
	             style="max-width:480px;background:#141419;border:1px solid #2a2a33;border-radius:12px;overflow:hidden;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
	        <tr><td style="padding:28px 32px 8px;">
	          <div style="font-size:22px;font-weight:700;letter-spacing:1px;color:#bb99ff;">VISUAL LIFE</div>
	        </td></tr>
	        <tr><td style="padding:8px 32px 24px;color:#d8d8e0;font-size:15px;line-height:1.6;">
	          <p style="margin:0 0 16px;">${greeting}</p>
	          <p style="margin:0 0 16px;">Thanks for checking out <strong style="color:#fff;">Visual Life</strong> — I'm genuinely glad you're here.</p>
	          <p style="margin:0 0 16px;">You're in early, so you're among the first to play with it. More worlds, effects, and controls are on the way — <strong style="color:#e0a070;">stay tuned for updates</strong>.</p>
	          <p style="margin:0 0 16px;">Got thoughts, bugs, or ideas? Just reply to this email — it comes straight to me.</p>
	          <p style="margin:24px 0 0;color:#9a9aa5;">Enjoy the visuals,<br/>— Visual Life</p>
	        </td></tr>
	        <tr><td style="padding:16px 32px 28px;border-top:1px solid #2a2a33;">
	          <a href="https://visuallife.netlify.app" style="color:#66ddbb;text-decoration:none;font-size:13px;">visuallife.netlify.app</a>
	        </td></tr>
	      </table>
	    </td></tr>
	  </table>
	</div>`

	return { subject, text, html }
}

// Fire-and-forget from the signup route — resolves quietly, never throws.
async function sendWelcomeEmail(to, firstName) {
	if (!resend) return // provider not configured — no-op
	const { subject, text, html } = welcomeTemplate(firstName)
	try {
		await resend.emails.send({ from: FROM, to, replyTo: REPLY_TO, subject, text, html })
	} catch (err) {
		console.error('[email] welcome send failed:', err && err.message)
		Sentry.captureException(err)
	}
}

module.exports = { sendWelcomeEmail }
