module.exports = (req, res, next) => {
	if (req.headers.authorization) {
		req.headers.authorization = req.headers.authorization.replace('Token token=', 'Bearer ')
	}
	next()
}
