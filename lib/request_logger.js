module.exports = (req, res, next) => {
	console.log('\n===== Incoming Request =====')
	console.log(`${new Date()}`)
	console.log(`${req.method} ${req.url}`)
	if (Object.keys(req.body || {}).length) console.log(`body ${JSON.stringify(req.body)}`)
	console.log('============================\n')
	next()
}
