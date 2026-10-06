require('dotenv').config();
const readline = require('readline');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const Admin = require('../models/Admin');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      rl._writeToOutput = (s) => { if (s.includes(question)) rl.output.write(s); else rl.output.write('*'.repeat(s.length > 1 ? 0 : s.length)); };
    }
    rl.question(question, (answer) => { rl.close(); if (hidden) process.stdout.write('\n'); resolve(answer); });
  });
}

(async () => {
  if (!process.env.MONGO_URI) { console.error('MONGO_URI is not set (see .env.example).'); process.exit(1); }
  // Non-interactive use (CI/dev): ADMIN_EMAIL and ADMIN_PASSWORD env vars.
  const email = (process.env.ADMIN_EMAIL || (await ask('Admin email: '))).trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || (await ask('Admin password (min 10 chars): ', { hidden: true }));

  if (!EMAIL_RE.test(email)) { console.error('That is not a valid email address.'); process.exit(1); }
  if (password.length < 10 || password.length > 128) { console.error('Password must be 10–128 characters.'); process.exit(1); }

  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 });
  await Admin.init();
  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await Admin.findOne({ email });
  if (existing) {
    existing.passwordHash = passwordHash;
    await existing.save();
    console.log(`Updated password for ${email}`);
  } else {
    await Admin.create({ email, passwordHash });
    console.log(`Created admin ${email}`);
  }
  await mongoose.disconnect();
})().catch((err) => { console.error(err.message); process.exit(1); });
