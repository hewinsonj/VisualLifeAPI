module.exports = (req, res, next) => {
	Object.values(req.body).forEach((obj) => {
		if (typeof obj === 'object' && obj !== null) {
			for (const key in obj) {
				if (obj[key] === '') delete obj[key]
			}
		}
	})
	next()
}
