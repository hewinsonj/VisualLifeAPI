// Gate admin-only routes. Runs AFTER requireToken (passport bearer), which sets
// req.user, so we can just check the flag. Never trust the client for this.
module.exports = function requireAdmin(req, res, next) {
	if (req.user && req.user.isAdmin) return next()
	res.status(403).json({ error: 'Admin access required' })
}
