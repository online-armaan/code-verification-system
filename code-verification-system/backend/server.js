require('dotenv').config();

const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const mongoose = require('mongoose');
const createApp = require('./app');

const { MONGO_URI, JWT_SECRET } = process.env;
const PORT = process.env.PORT || 5000;

if (!MONGO_URI) {
  console.error('MONGO_URI is not set. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error('JWT_SECRET must be set to a random string of at least 32 characters.');
  console.error(
    'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"'
  );
  process.exit(1);
}

(async () => {
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 8000
    });

    // Build the unique index on `code` before accepting traffic.
    await Promise.all(
      Object.values(mongoose.models).map((m) => m.init())
    );

    console.log('MongoDB connected');

    const server = createApp().listen(
      PORT,
      () => console.log(`API listening on http://localhost:${PORT}`)
    );

    const shutdown = () =>
      server.close(() =>
        mongoose.disconnect().then(() => process.exit(0))
      );

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

  } catch (err) {
    console.error('Failed to start:', err.message);
    process.exit(1);
  }
})();