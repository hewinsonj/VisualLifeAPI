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
	const subject = 'Welcome to VisualLife'

	const text = [
		greeting,
		'',
		"You're in early — thanks for being here. Visual Life is just getting started, with",
		'more worlds and effects on the way.',
		'',
		'Have a bug, an idea, or just a thought? Reply straight to me.',
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
	          <p style="margin:0 0 16px;">You're in early — thanks for being here. <strong style="color:#fff;">Visual Life</strong> is just getting started, with more worlds and effects on the way.</p>
	          <p style="margin:0 0 16px;">Have a bug, an idea, or just a thought? Reply straight to me.</p>
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
	if (!resend) return { skipped: true } // provider not configured — no-op
	const { subject, text, html } = welcomeTemplate(firstName)
	try {
		const { data, error } = await resend.emails.send({ from: FROM, to, replyTo: REPLY_TO, subject, text, html })
		if (error) {
			console.error('[email] welcome send error:', error)
			Sentry.captureException(new Error(error.message || 'resend send error'))
		}
		return { data, error }
	} catch (err) {
		console.error('[email] welcome send failed:', err && err.message)
		Sentry.captureException(err)
		return { error: err }
	}
}

function passwordResetTemplate(firstName, resetUrl) {
	const name = (firstName || '').trim()
	const greeting = name ? `Hi ${name},` : 'Hi there,'
	const subject = 'Reset your VisualLife password'

	const text = [
		greeting,
		'',
		'Someone (hopefully you) asked to reset your Visual Life password. Open this link',
		'to set a new one — it expires in 1 hour:',
		'',
		resetUrl,
		'',
		"Didn't request this? You can safely ignore this email; your password won't change.",
		'',
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
	          <p style="margin:0 0 20px;">Someone (hopefully you) asked to reset your <strong style="color:#fff;">Visual Life</strong> password. Tap the button to set a new one — it expires in <strong style="color:#e0a070;">1 hour</strong>.</p>
	          <p style="margin:0 0 20px;">
	            <a href="${resetUrl}" style="display:inline-block;background:#6a4bc0;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 22px;border-radius:8px;">Reset password</a>
	          </p>
	          <p style="margin:0 0 4px;color:#9a9aa5;font-size:12px;">Or paste this link into your browser:</p>
	          <p style="margin:0 0 16px;word-break:break-all;"><a href="${resetUrl}" style="color:#66ddbb;text-decoration:none;font-size:12px;">${resetUrl}</a></p>
	          <p style="margin:20px 0 0;color:#9a9aa5;font-size:13px;">Didn't request this? You can safely ignore this email — your password won't change.</p>
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

// Fire-and-forget from the forgot-password route. Returns { skipped } when the provider
// isn't configured, so the caller can still respond with the generic success message.
async function sendPasswordResetEmail(to, firstName, resetUrl) {
	if (!resend) return { skipped: true }
	const { subject, text, html } = passwordResetTemplate(firstName, resetUrl)
	try {
		const { data, error } = await resend.emails.send({ from: FROM, to, replyTo: REPLY_TO, subject, text, html })
		if (error) {
			console.error('[email] password-reset send error:', error)
			Sentry.captureException(new Error(error.message || 'resend send error'))
		}
		return { data, error }
	} catch (err) {
		console.error('[email] password-reset send failed:', err && err.message)
		Sentry.captureException(err)
		return { error: err }
	}
}

module.exports = { sendWelcomeEmail, sendPasswordResetEmail }
