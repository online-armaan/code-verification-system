const Batch = require('../models/Batch');

// Allocates BATCH-YYYY-NNN. The unique index guarantees no duplicates;
// on a collision we retry with the next sequence number.
async function createBatch(size) {
  const year = new Date().getFullYear();
  for (let attempt = 0; attempt < 10; attempt++) {
    const last = await Batch.findOne({ year }).sort({ seq: -1 }).lean();
    const seq = (last ? last.seq : 0) + 1;
    const batchId = `BATCH-${year}-${String(seq).padStart(3, '0')}`;
    try {
      return await Batch.create({ batchId, year, seq, size });
    } catch (err) {
      if (err.code !== 11000) throw err;
    }
  }
  throw new Error('Could not allocate batch id');
}
module.exports = { createBatch };
