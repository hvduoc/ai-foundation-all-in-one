// tests/userRoute.test.js
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const Fastify = require('fastify');
const RedisMock = require('ioredis-mock');

const userRoutes = require('../src/routes/user'); // đổi path nếu khác

let app;
let redis;

beforeEach(async () => {
  app = Fastify({ logger: false });
  redis = new RedisMock();
  app.decorate('redis', redis);
  await app.register(userRoutes, { prefix: '/api' });
  await app.ready();
});

afterEach(async () => {
  await app.close();
  if (redis?.quit) await redis.quit();
});

test('Cache MISS: lần đầu gọi', async () => {
  const res = await app.inject({ method: 'GET', url: '/api/user/1' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['x-cache'], 'MISS');
  const body = res.json();
  assert.equal(body.fromCache, false);
  assert.equal(body.data.id, 1);
});

test('Cache HIT: gọi lại cùng id', async () => {
  await app.inject({ method: 'GET', url: '/api/user/1' }); // seed MISS
  const res = await app.inject({ method: 'GET', url: '/api/user/1' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['x-cache'], 'HIT');
  const body = res.json();
  assert.equal(body.fromCache, true);
  assert.equal(body.data.id, 1);
});

test('Cache BYPASS: khi Redis lỗi', async () => {
  const origGet = redis.get.bind(redis);
  redis.get = async () => { throw new Error('boom'); };

  const res = await app.inject({ method: 'GET', url: '/api/user/1' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['x-cache'], 'BYPASS');
  const body = res.json();
  assert.equal(body.fromCache, false);
  assert.equal(body.data.id, 1);

  redis.get = origGet;
});
