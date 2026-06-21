const express = require('express')
const passport = require('passport')
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)

const User = require('../models/user')

const requireToken = passport.authenticate('bearer', { session: false })
const router = express.Router()

// POST /subscribe — create a Stripe checkout session
// Client redirects to the returned URL to complete payment
router.post('/subscribe', requireToken, async (req, res, next) => {
	try {
		const user = await User.findById(req.user.id)

		// Create or reuse Stripe customer
		let customerId = user.stripeCustomerId
		if (!customerId) {
			const customer = await stripe.customers.create({ email: user.email })
			customerId = customer.id
			user.stripeCustomerId = customerId
			await user.save()
		}

		const session = await stripe.checkout.sessions.create({
			customer: customerId,
			payment_method_types: ['card'],
			mode: 'subscription',
			line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
			// trial_period_days handled on the Stripe Price object, not here,
			// so returning subscribers don't get a second trial
			success_url: `${process.env.CLIENT_ORIGIN}/subscribe/success`,
			cancel_url: `${process.env.CLIENT_ORIGIN}/subscribe/cancel`,
		})

		res.json({ url: session.url })
	} catch (err) {
		next(err)
	}
})

// POST /stripe/webhook — Stripe sends events here
// Must receive raw body (not JSON-parsed) for signature verification.
// Mounted BEFORE express.json() in server.js.
router.post(
	'/stripe/webhook',
	express.raw({ type: 'application/json' }),
	async (req, res) => {
		const sig = req.headers['stripe-signature']
		let event

		try {
			event = stripe.webhooks.constructEvent(
				req.body,
				sig,
				process.env.STRIPE_WEBHOOK_SECRET
			)
		} catch (err) {
			console.error('Webhook signature failed:', err.message)
			return res.status(400).send(`Webhook Error: ${err.message}`)
		}

		const session = event.data.object

		switch (event.type) {
			case 'checkout.session.completed': {
				// Payment succeeded — activate subscription
				const customer = await stripe.customers.retrieve(session.customer)
				await User.findOneAndUpdate(
					{ stripeCustomerId: session.customer },
					{
						subscriptionStatus: 'active',
						stripeSubscriptionId: session.subscription,
					}
				)
				break
			}

			case 'customer.subscription.updated': {
				const status = session.status // 'active' | 'past_due' | 'canceled' etc.
				const subscriptionStatus =
					status === 'active' ? 'active' : status === 'canceled' ? 'canceled' : 'none'
				await User.findOneAndUpdate(
					{ stripeCustomerId: session.customer },
					{ subscriptionStatus }
				)
				break
			}

			case 'customer.subscription.deleted': {
				await User.findOneAndUpdate(
					{ stripeCustomerId: session.customer },
					{ subscriptionStatus: 'canceled', stripeSubscriptionId: null }
				)
				break
			}

			default:
				// Unhandled event — ignore
				break
		}

		res.json({ received: true })
	}
)

module.exports = router
