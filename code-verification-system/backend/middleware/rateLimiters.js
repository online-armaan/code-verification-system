const rateLimit = require('express-rate-limit');

const make = (windowMs, max, message) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) =>
      res.status(429).json({ success: false, status: 'rate_limited', code: 'RATE_LIMITED', message }),
  });

const noop = (req, res, next) => next();
const disabled = () => process.env.DISABLE_RATE_LIMIT === 'true';

// Public verification: 30 attempts / 15 min / IP slows code guessing.
const verifyLimiter = disabled() ? noop : make(15 * 60 * 1000, 30, 'Too many attempts. Please wait a few minutes and try again.');
// Login: 10 attempts / 15 min / IP slows password guessing.
const loginLimiter = disabled() ? noop : make(15 * 60 * 1000, 10, 'Too many login attempts. Please try again later.');

module.exports = { verifyLimiter, loginLimiter, make };
