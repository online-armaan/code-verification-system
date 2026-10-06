const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const AppError = require('../utils/AppError');

const COOKIE_NAME = 'cvs_token';

async function requireAdmin(req, res, next) {
  try {
    const header = req.headers.authorization;
    const token = req.cookies?.[COOKIE_NAME] || (header && header.startsWith('Bearer ') ? header.slice(7) : null);
    if (!token) throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    const admin = await Admin.findById(payload.sub).select('email').lean();
    if (!admin) throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
    req.admin = { id: String(admin._id), email: admin.email };
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { requireAdmin, COOKIE_NAME };
