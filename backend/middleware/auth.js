const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token tidak ditemukan' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'temanbelajar_secret');
    next();
  } catch {
    res.status(401).json({ message: 'Token tidak valid' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Akses ditolak' });
  next();
};

module.exports = { auth, adminOnly };
