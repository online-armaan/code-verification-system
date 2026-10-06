// Run with: npm test   (needs a running MongoDB; uses TEST_MONGO_URI or a local "cvs-test" database)
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-123456';
process.env.DISABLE_RATE_LIMIT = 'true';
process.env.CLIENT_URL = 'http://localhost:5173';

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const request = require('supertest');
const createApp = require('../app');
const Code = require('../models/Code');
const Admin = require('../models/Admin');
const Redemption = require('../models/Redemption');

const MONGO_URI = process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/cvs-test';
const ADMIN = { email: 'admin@example.com', password: 'a-long-test-password' };
let server;
let cookie; // admin session

before(async () => {
  await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 8000 });
  await Promise.all([Code.deleteMany({}), Admin.deleteMany({}), Redemption.deleteMany({})]);
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
  await Admin.create({ email: ADMIN.email, passwordHash: await bcrypt.hash(ADMIN.password, 4) });
  server = createApp().listen(0);
  const res = await request(server).post('/api/auth/login').send(ADMIN);
  cookie = res.headers['set-cookie'];
});

after(async () => {
  await Promise.all([Code.deleteMany({}), Admin.deleteMany({}), Redemption.deleteMany({})]);
  await mongoose.disconnect();
  server.close();
});

const verify = (code) => request(server).post('/api/codes/verify').send({ code });
const authed = (req) => req.set('Cookie', cookie);

describe('verification', () => {
  test('valid code succeeds once and is marked used', async () => {
    await Code.create({ code: 'ABCD-1234-EFGH' });
    const res = await verify('ABCD-1234-EFGH');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { success: true, status: 'valid', message: 'Code verified successfully.' });
    const doc = await Code.findOne({ code: 'ABCD-1234-EFGH' });
    assert.equal(doc.status, 'used');
    assert.ok(doc.usedAt);
  });

  test('already used code is reported as used', async () => {
    const res = await verify('ABCD-1234-EFGH');
    assert.equal(res.body.status, 'used');
    assert.equal(res.body.success, false);
  });

  test('input is trimmed and case-insensitive', async () => {
    await Code.create({ code: 'NORM-1111-AAAA' });
    const res = await verify('  norm-1111-aaaa  ');
    assert.equal(res.body.status, 'valid');
  });

  test('unknown code is invalid', async () => {
    const res = await verify('ZZZZ-0000-ZZZZ');
    assert.equal(res.status, 404);
    assert.equal(res.body.status, 'invalid');
  });

  test('expired code (by date or status) is invalid and stays unredeemed', async () => {
    await Code.create({ code: 'OLD1-2222-BBBB', expiresAt: new Date(Date.now() - 1000) });
    await Code.create({ code: 'OLD2-3333-CCCC', status: 'expired' });
    assert.equal((await verify('OLD1-2222-BBBB')).body.status, 'invalid');
    assert.equal((await verify('OLD2-3333-CCCC')).body.status, 'invalid');
    assert.equal((await Code.findOne({ code: 'OLD1-2222-BBBB' })).status, 'unused');
  });

  test('rejects missing, non-string and operator-injection input', async () => {
    assert.equal((await request(server).post('/api/codes/verify').send({})).status, 400);
    assert.equal((await request(server).post('/api/codes/verify').send({ code: { $ne: null } })).status, 400);
    assert.equal((await verify('bad code!!')).body.status, 'invalid');
  });

  test('100 simultaneous requests redeem one code exactly once', async () => {
    await Code.create({ code: 'RACE-9999-ZZZZ' });
    const results = await Promise.all(Array.from({ length: 100 }, () => verify('RACE-9999-ZZZZ')));
    const wins = results.filter((r) => r.body.status === 'valid');
    const used = results.filter((r) => r.body.status === 'used');
    assert.equal(wins.length, 1, `expected exactly 1 success, got ${wins.length}`);
    assert.equal(used.length, 99);
  });
});

describe('admin auth', () => {
  test('login succeeds with correct credentials and sets an HttpOnly cookie', async () => {
    const res = await request(server).post('/api/auth/login').send(ADMIN);
    assert.equal(res.status, 200);
    assert.match(res.headers['set-cookie'][0], /HttpOnly/);
    assert.equal(res.body.admin.email, ADMIN.email);
  });

  test('login fails with a wrong password or unknown email', async () => {
    assert.equal((await request(server).post('/api/auth/login').send({ email: ADMIN.email, password: 'nope-nope-nope' })).status, 401);
    assert.equal((await request(server).post('/api/auth/login').send({ email: 'x@y.com', password: 'whatever-long' })).status, 401);
  });

  test('admin endpoints reject unauthenticated and invalid-token requests', async () => {
    for (const [method, path] of [
      ['get', '/api/admin/stats'], ['get', '/api/admin/codes'], ['post', '/api/admin/codes'],
      ['post', '/api/admin/codes/generate'], ['get', '/api/admin/codes/export'],
      ['get', '/api/admin/batches'], ['delete', '/api/admin/codes/507f1f77bcf86cd799439011'], ['get', '/api/auth/me'],
    ]) {
      const res = await request(server)[method](path).send({});
      assert.equal(res.status, 401, `${method.toUpperCase()} ${path}`);
    }
    const bad = await request(server).get('/api/admin/stats').set('Authorization', 'Bearer not.a.jwt');
    assert.equal(bad.status, 401);
  });

  test('/auth/me returns the logged-in admin', async () => {
    const res = await authed(request(server).get('/api/auth/me'));
    assert.equal(res.body.admin.email, ADMIN.email);
  });
});

describe('admin code management', () => {
  test('manually add a code (normalized, default unused)', async () => {
    const res = await authed(request(server).post('/api/admin/codes')).send({ code: ' man1-0000-test ' });
    assert.equal(res.status, 201);
    assert.equal(res.body.code.code, 'MAN1-0000-TEST');
    assert.equal(res.body.code.status, 'unused');
  });

  test('duplicate code creation is rejected with a clear error', async () => {
    const res = await authed(request(server).post('/api/admin/codes')).send({ code: 'MAN1-0000-TEST' });
    assert.equal(res.status, 409);
    assert.equal(res.body.code, 'DUPLICATE_CODE');
    assert.match(res.body.message, /already exists/);
  });

  test('rejects invalid format and past expiry', async () => {
    assert.equal((await authed(request(server).post('/api/admin/codes')).send({ code: 'no spaces' })).status, 400);
    assert.equal((await authed(request(server).post('/api/admin/codes')).send({ code: 'GOOD-CODE', expiresAt: '2000-01-01' })).status, 400);
  });

  test('random generation: unique, secure-format codes in a new batch', async () => {
    const res = await authed(request(server).post('/api/admin/codes/generate')).send({ count: 500, format: 'XXXX-XXXX-XXXX' });
    assert.equal(res.status, 201);
    assert.equal(res.body.codes.length, 500);
    assert.equal(new Set(res.body.codes).size, 500);
    assert.match(res.body.batchId, /^BATCH-\d{4}-\d{3}$/);
    for (const c of res.body.codes) assert.match(c, /^[A-HJ-KM-NP-TW-Z2-9]{4}-[A-HJ-KM-NP-TW-Z2-9]{4}-[A-HJ-KM-NP-TW-Z2-9]{4}$/);
    assert.equal(await Code.countDocuments({ batchId: res.body.batchId }), 500);
  });

  test('generation validates count and format', async () => {
    assert.equal((await authed(request(server).post('/api/admin/codes/generate')).send({ count: 0 })).status, 400);
    assert.equal((await authed(request(server).post('/api/admin/codes/generate')).send({ count: 5, format: 'abc' })).status, 400);
    assert.equal((await authed(request(server).post('/api/admin/codes/generate')).send({ count: 7000, format: 'XX-X' })).status, 400);
  });

  test('stats, filtered list, batches, export and delete', async () => {
    const stats = (await authed(request(server).get('/api/admin/stats'))).body.stats;
    assert.equal(stats.total, stats.unused + stats.used + stats.expired);
    assert.ok(stats.used >= 3 && stats.expired >= 2);

    const list = await authed(request(server).get('/api/admin/codes?status=used&limit=2&page=1'));
    assert.equal(list.body.codes.length, 2);
    assert.ok(list.body.codes.every((c) => c.status === 'used'));
    const search = await authed(request(server).get('/api/admin/codes?search=man1-0000'));
    assert.equal(search.body.codes.length, 1);
    assert.equal((await authed(request(server).get('/api/admin/codes?status=bogus'))).status, 400);

    const batches = (await authed(request(server).get('/api/admin/batches'))).body.batches;
    assert.equal(batches[0].total, 500);
    assert.equal(batches[0].unused, 500);

    const csv = await authed(request(server).get('/api/admin/codes/export'));
    assert.match(csv.headers['content-type'], /text\/csv/);
    assert.match(csv.text.split('\r\n')[0], /Code/);

    const target = search.body.codes[0];
    assert.equal((await authed(request(server).delete(`/api/admin/codes/${target.id}`))).status, 200);
    assert.equal((await Code.findById(target.id)), null);
    assert.equal((await authed(request(server).delete('/api/admin/codes/not-an-id'))).status, 400);
  });
});
