const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const AppError = require('../utils/AppError');
const { COOKIE_NAME } = require('../middleware/auth');

const TOKEN_TTL_SECONDS = 8 * 60 * 60;
// Compared against when the email is unknown, so response time doesn't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.COOKIE_SAMESITE || 'lax',
  maxAge: TOKEN_TTL_SECONDS * 1000,
  path: '/',
});

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
      throw new AppError('Email and password are required.', 400, 'VALIDATION_ERROR');
    }
    const admin = await Admin.findOne({ email: email.trim().toLowerCase() });
    const ok = await bcrypt.compare(password, admin ? admin.passwordHash : DUMMY_HASH);
    if (!admin || !ok) throw new AppError('Incorrect email or password.', 401, 'INVALID_CREDENTIALS');

    const token = jwt.sign({ sub: String(admin._id) }, process.env.JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: TOKEN_TTL_SECONDS,
    });
    res.cookie(COOKIE_NAME, token, cookieOptions());
    res.json({ success: true, admin: { email: admin.email } });
  } catch (err) {
    next(err);
  }
};

exports.logout = (req, res) => {
  res.clearCookie(COOKIE_NAME, { ...cookieOptions(), maxAge: undefined });
  res.json({ success: true });
};

exports.me = (req, res) => res.json({ success: true, admin: { email: req.admin.email } });

exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
      throw new AppError('Current and new password are required.', 400, 'VALIDATION_ERROR');
    }
    if (newPassword.length < 10 || newPassword.length > 128) {
      throw new AppError('New password must be 10–128 characters.', 400, 'VALIDATION_ERROR');
    }
    const admin = await Admin.findById(req.admin.id);
    if (!admin || !(await bcrypt.compare(currentPassword, admin.passwordHash))) {
      throw new AppError('Current password is incorrect.', 400, 'INVALID_CREDENTIALS');
    }
    admin.passwordHash = await bcrypt.hash(newPassword, 12);
    await admin.save();
    res.json({ success: true, message: 'Password updated.' });
  } catch (err) {
    next(err);
  }
};
