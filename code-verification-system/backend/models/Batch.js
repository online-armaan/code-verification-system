const mongoose = require('mongoose');

// Used to number batches (BATCH-YYYY-NNN); the unique index prevents duplicate ids.
const batchSchema = new mongoose.Schema(
  {
    batchId: { type: String, required: true, unique: true },
    year: { type: Number, required: true },
    seq: { type: Number, required: true },
    size: { type: Number, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

module.exports = mongoose.model('Batch', batchSchema);
