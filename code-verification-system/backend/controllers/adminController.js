const mongoose = require('mongoose');
const Code = require('../models/Code');
const Batch = require('../models/Batch');
const Redemption = require('../models/Redemption');
const AppError = require('../utils/AppError');
const { toCsv } = require('../utils/csv');
const { createBatch } = require('../utils/batch');
const { normalizeCode, isValidCodeFormat, isValidPattern, generateCode, keyspace } = require('../utils/codeUtils');

const MAX_GENERATE = 10000;
const STATUSES = ['unused', 'used', 'expired'];
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Unused codes whose expiry date has passed are flipped to "expired" so every view agrees.
const sweepExpired = () =>
  Code.updateMany({ status: 'unused', expiresAt: { $ne: null, $lte: new Date() } }, { $set: { status: 'expired' } });

function parseExpiry(value) {
  if (value === undefined || value === null || value === '') return null;
  const d = new Date(value);
  if (typeof value !== 'string' || Number.isNaN(d.getTime())) {
    throw new AppError('Expiry must be a valid date.', 400, 'VALIDATION_ERROR', { field: 'expiresAt' });
  }
  if (d.getTime() <= Date.now()) {
    throw new AppError('Expiry must be in the future.', 400, 'VALIDATION_ERROR', { field: 'expiresAt' });
  }
  return d;
}

function buildFilter(query) {
  const filter = {};
  if (query.status !== undefined && query.status !== '') {
    if (typeof query.status !== 'string' || !STATUSES.includes(query.status)) {
      throw new AppError('Unknown status filter.', 400, 'VALIDATION_ERROR', { field: 'status' });
    }
    filter.status = query.status;
  }
  if (typeof query.batchId === 'string' && query.batchId) filter.batchId = query.batchId;
  if (typeof query.search === 'string' && query.search.trim()) {
    const term = escapeRegex(query.search.trim().toUpperCase().slice(0, 64));
    filter.$or = [{ code: { $regex: term } }, { batchId: { $regex: term } }];
  }
  return filter;
}

const toDto = (c) => ({
  id: String(c._id),
  code: c.code,
  status: c.status,
  createdAt: c.createdAt,
  usedAt: c.usedAt,
  expiresAt: c.expiresAt,
  batchId: c.batchId,
});

exports.stats = async (req, res, next) => {
  try {
    await sweepExpired();
    const [total, unused, used, expired] = await Promise.all([
      Code.countDocuments({}),
      Code.countDocuments({ status: 'unused' }),
      Code.countDocuments({ status: 'used' }),
      Code.countDocuments({ status: 'expired' }),
    ]);
    res.json({ success: true, stats: { total, unused, used, expired } });
  } catch (err) {
    next(err);
  }
};

exports.listCodes = async (req, res, next) => {
  try {
    await sweepExpired();
    const filter = buildFilter(req.query);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const [items, total] = await Promise.all([
      Code.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Code.countDocuments(filter),
    ]);
    res.json({
      success: true,
      codes: items.map(toDto),
      pagination: { page, limit, total, pages: Math.max(Math.ceil(total / limit), 1) },
    });
  } catch (err) {
    next(err);
  }
};

exports.addCode = async (req, res, next) => {
  try {
    const { code: raw, expiresAt } = req.body || {};
    if (typeof raw !== 'string' || !raw.trim()) {
      throw new AppError('Code is required.', 400, 'VALIDATION_ERROR', { field: 'code' });
    }
    const code = normalizeCode(raw);
    if (!isValidCodeFormat(code)) {
      throw new AppError(
        'Code must be 4–64 characters: letters, numbers and single hyphens only (e.g. ABCD-1234-EFGH).',
        400, 'INVALID_CODE_FORMAT', { field: 'code' }
      );
    }
    const expiry = parseExpiry(expiresAt);
    try {
      const doc = await Code.create({ code, status: 'unused', expiresAt: expiry });
      res.status(201).json({ success: true, code: toDto(doc) });
    } catch (err) {
      if (err.code === 11000) {
        throw new AppError(`The code ${code} already exists.`, 409, 'DUPLICATE_CODE', { field: 'code' });
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
};

exports.generateCodes = async (req, res, next) => {
  try {
    const { count, format = 'XXXX-XXXX-XXXX', expiresAt } = req.body || {};
    const n = Number(count);
    if (!Number.isInteger(n) || n < 1 || n > MAX_GENERATE) {
      throw new AppError(`Number of codes must be a whole number from 1 to ${MAX_GENERATE}.`, 400, 'VALIDATION_ERROR', { field: 'count' });
    }
    if (!isValidPattern(format)) {
      throw new AppError('Format may only contain X (random character) and hyphens, e.g. XXXX-XXXX-XXXX.', 400, 'VALIDATION_ERROR', { field: 'format' });
    }
    if (n > keyspace(format) * 0.25) {
      throw new AppError('That format cannot produce this many unique codes. Use a longer format.', 400, 'VALIDATION_ERROR', { field: 'format' });
    }
    const expiry = parseExpiry(expiresAt);
    const batch = await createBatch(n);

    // Guarantee exactly n unique codes: insert unordered; any code that collides with an existing
    // one (unique index) is simply regenerated and retried.
    const inserted = [];
    let attempts = 0;
    while (inserted.length < n && attempts++ < 20) {
      const need = n - inserted.length;
      const pool = new Set(inserted);
      const fresh = new Set();
      while (fresh.size < need) {
        const c = generateCode(format);
        if (!pool.has(c)) fresh.add(c);
      }
      const list = [...fresh];
      const createdAt = new Date();
      const docs = list.map((code) => ({ code, status: 'unused', usedAt: null, expiresAt: expiry, batchId: batch.batchId, createdAt }));
      try {
        await Code.collection.insertMany(docs, { ordered: false });
        inserted.push(...list);
      } catch (err) {
        const failed = new Set((err.writeErrors || []).map((e) => e.err?.index ?? e.index));
        if (!err.writeErrors || !err.writeErrors.every((e) => (e.err?.code ?? e.code) === 11000)) throw err;
        list.forEach((c, i) => { if (!failed.has(i)) inserted.push(c); });
      }
    }
    if (inserted.length < n) throw new AppError('Could not generate enough unique codes.', 500, 'GENERATION_FAILED');

    res.status(201).json({ success: true, batchId: batch.batchId, count: inserted.length, expiresAt: expiry, codes: inserted });
  } catch (err) {
    next(err);
  }
};

exports.deleteCode = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      throw new AppError('Invalid code id.', 400, 'INVALID_ID');
    }
    const deleted = await Code.findByIdAndDelete(req.params.id).lean();
    if (!deleted) throw new AppError('Code not found.', 404, 'NOT_FOUND');
    await Redemption.deleteOne({ code: deleted.code });
    res.json({ success: true, message: 'Code deleted.' });
  } catch (err) {
    next(err);
  }
};

exports.exportCodes = async (req, res, next) => {
  try {
    await sweepExpired();
    const filter = buildFilter(req.query);
    const rows = await Code.find(filter).sort({ createdAt: -1, _id: -1 }).limit(100000).lean();
    const csv = toCsv(
      ['Code', 'Status', 'Batch ID', 'Created', 'Used', 'Expires'],
      rows.map((c) => [c.code, c.status, c.batchId, c.createdAt, c.usedAt, c.expiresAt])
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="codes-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
};

exports.listBatches = async (req, res, next) => {
  try {
    await sweepExpired();
    const groups = await Code.aggregate([
      { $match: { batchId: { $ne: null } } },
      { $group: { _id: { batchId: '$batchId', status: '$status' }, n: { $sum: 1 } } },
    ]);
    const counts = new Map();
    for (const g of groups) {
      const c = counts.get(g._id.batchId) || { total: 0, used: 0, unused: 0, expired: 0 };
      c[g._id.status] = (c[g._id.status] || 0) + g.n;
      c.total += g.n;
      counts.set(g._id.batchId, c);
    }
    const meta = await Batch.find({}).sort({ year: -1, seq: -1 }).lean();
    const batches = meta.map((b) => {
      const g = counts.get(b.batchId) || { total: 0, used: 0, unused: 0, expired: 0 };
      return { batchId: b.batchId, createdAt: b.createdAt, generated: b.size, total: g.total, used: g.used, unused: g.unused, expired: g.expired };
    });
    res.json({ success: true, batches });
  } catch (err) {
    next(err);
  }
};
