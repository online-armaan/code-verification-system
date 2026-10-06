const mongoose = require('mongoose');

const codeSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    status: { type: String, enum: ['unused', 'used', 'expired'], default: 'unused', index: true },
    usedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    batchId: { type: String, default: null, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

module.exports = mongoose.model('Code', codeSchema);
