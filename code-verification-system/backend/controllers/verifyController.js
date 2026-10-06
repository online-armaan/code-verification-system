const Code = require('../models/Code');
const Redemption = require('../models/Redemption');
const AppError = require('../utils/AppError');
const { normalizeCode, isValidCodeFormat } = require('../utils/codeUtils');

const RESPONSES = {
  valid: { http: 200, body: { success: true, status: 'valid', message: 'Code verified successfully.' } },
  used: { http: 409, body: { success: false, status: 'used', message: 'Code has already been used.' } },
  invalid: { http: 404, body: { success: false, status: 'invalid', message: 'Code is invalid or expired.' } },
};

exports.verifyCode = async (req, res, next) => {
  try {
    const raw = req.body && req.body.code;
    // Must be a string: blocks operator injection such as { "code": { "$ne": null } }.
    if (typeof raw !== 'string' || !raw.trim()) {
      throw new AppError('Please enter a code.', 400, 'VALIDATION_ERROR', { field: 'code' });
    }
    const code = normalizeCode(raw);
    if (!isValidCodeFormat(code)) {
      return res.status(RESPONSES.invalid.http).json(RESPONSES.invalid.body);
    }

    const now = new Date();

    // ATOMIC claim: the filter (status = unused, not past expiry) and the update happen in one
    // server-side operation, so when many requests race for one code exactly one gets a document back.
    const claimed = await Code.findOneAndUpdate(
      { code, status: 'unused', $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] },
      { $set: { status: 'used', usedAt: now } },
      { new: true }
    ).lean();

    if (claimed) {
      // Second guard: the unique index on Redemption.code admits exactly one insert per code.
      // If it was already taken, another request won the race, so this one reports "used".
      try {
        await Redemption.create({ code, redeemedAt: now });
      } catch (err) {
        if (err.code === 11000) return res.status(RESPONSES.used.http).json(RESPONSES.used.body);
        throw err; // fail closed: the code stays consumed rather than risk a second redemption
      }
      return res.status(RESPONSES.valid.http).json(RESPONSES.valid.body);
    }

    // Not claimed: tell "already used" apart from "unknown/expired". Read-only, so no race risk.
    const existing = await Code.findOne({ code }, { status: 1 }).lean();
    const key = existing && existing.status === 'used' ? 'used' : 'invalid';
    return res.status(RESPONSES[key].http).json(RESPONSES[key].body);
  } catch (err) {
    next(err);
  }
};
