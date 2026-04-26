const authenticate = (req, res, next) => {
  // Gateway injects verified user info via headers
  const userId = req.headers['x-user-id'];
  const userEmail = req.headers['x-user-email'];
  const userRole = req.headers['x-user-role'];

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized: missing user context' });
  }

  req.user = { id: userId, email: userEmail, role: userRole };
  next();
};

const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: admin access required' });
  }
  next();
};

module.exports = { authenticate, requireAdmin };
