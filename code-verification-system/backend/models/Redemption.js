const mongoose = require('mongoose');

// One document per successful redemption. The UNIQUE index on `code` is enforced atomically by the
// database, so it is a hard second guarantee that a code can never be redeemed twice, even if the
// primary findOneAndUpdate claim were ever to misbehave (e.g. on a Mongo-compatible store with weaker
// update atomicity).
const redemptionSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  redeemedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Redemption', redemptionSchema);
