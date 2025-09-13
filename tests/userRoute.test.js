const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const Fastify = require('fastify');
const RedisMock = require('ioredis-mock');
const userRoutes = require('../src/routes/user'); // chỉnh nếu đường dẫn khác

let app;
let redis;

beforeEach(async () => {
  app = Fastify({ logger: false });
  redis = new RedisMock();
  app.decorate('redis', redis);
  // mount plugin dưới prefix /api
  await app.register(userRoutes, { prefix: '/api' });
  await app.ready();
});

afterEach(async () => {
  await app.close();
  if (redis?.quit) await redis.quit();
});

test('Cache Miss: lần 1', async () => {
  const res = await app.inject({ method: 'GET', url: '/api/user/1' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['x-cache'], 'MISS');
  const body = res.json();
  assert.equal(body.fromCache, false);
  assert.equal(body.data.id, 1);
});

test('Cache Hit: lần 2', async () => {
  await app.inject({ method: 'GET', url: '/api/user/1' }); // seed MISS

  const res = await app.inject({ method: 'GET', url: '/api/user/1' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['x-cache'], 'HIT');
  const body = res.json();
  assert.equal(body.fromCache, true);
});

test('Cache BYPASS khi Redis lỗi', async () => {
  // làm get ném lỗi để giả lập sự cố Redis
  const origGet = redis.get.bind(redis);
  redis.get = async () => { throw new Error('boom'); };

  const res = await app.inject({ method: 'GET', url: '/api/user/1' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['x-cache'], 'BYPASS');
  const body = res.json();
  assert.equal(body.fromCache, false);

  // khôi phục nếu cần
  redis.get = origGet;
});
// tests/userRoute.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Fastify = require('fastify');
const RedisMock = require('ioredis-mock');
const userRoute = require('../src/routes/user');

test('Cache MISS', async () => {
  const fastify = Fastify();
  const mockRedis = new RedisMock();
  fastify.decorate('redis', mockRedis);
  await fastify.register(userRoute);
  await fastify.ready();

  const res = await fastify.inject({ method: 'GET', url: '/api/user/1' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['x-cache'], 'MISS');
  const body = JSON.parse(res.body);
  assert.equal(body.fromCache, false);
  await fastify.close();
});

test('Cache HIT', async () => {
  const fastify = Fastify();
  const mockRedis = new RedisMock();
  fastify.decorate('redis', mockRedis);
  await fastify.register(userRoute);
  await fastify.ready();

  // MISS lần đầu
  await fastify.inject({ method: 'GET', url: '/api/user/1' });
  // HIT lần hai
  const res = await fastify.inject({ method: 'GET', url: '/api/user/1' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['x-cache'], 'HIT');
  const body = JSON.parse(res.body);
  assert.equal(body.fromCache, true);
  await fastify.close();
});

test('Cache BYPASS', async () => {
  const fastify = Fastify();
  const mockRedis = new RedisMock();
  // BYPASS: mock lỗi get
  mockRedis.get = async () => { throw new Error('Redis error'); };
  fastify.decorate('redis', mockRedis);
  await fastify.register(userRoute);
  await fastify.ready();

  const res = await fastify.inject({ method: 'GET', url: '/api/user/1' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['x-cache'], 'BYPASS');
  const body = JSON.parse(res.body);
  assert.equal(body.fromCache, false);
  await fastify.close();
});
// tests/userRoute.test.js

const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const Fastify = require('fastify');
const RedisMock = require('ioredis-mock');
const userRoutes = require('../src/routes/user');

let fastify, redis;

beforeEach(async () => {
  fastify = Fastify();
  redis = new RedisMock();
  fastify.decorate('redis', redis);
  await userRoutes(fastify);
  await fastify.ready();
});

afterEach(async () => {
  await fastify.close();
  await redis.quit();
});

test('Cache MISS: lần đầu gọi trả về MISS, fromCache=false', async () => {
  const res = await fastify.inject({ method: 'GET', url: '/user/1' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['x-cache'], 'MISS');
  const body = JSON.parse(res.body);
  assert.equal(body.fromCache, false);
  assert.equal(body.data.id, 1);
});

test('Cache HIT: lần gọi thứ hai trả về HIT, fromCache=true', async () => {
  // Lần 1: MISS
  await fastify.inject({ method: 'GET', url: '/user/2' });
  // Lần 2: HIT
  const res = await fastify.inject({ method: 'GET', url: '/user/2' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['x-cache'], 'HIT');
  const body = JSON.parse(res.body);
  assert.equal(body.fromCache, true);
  assert.equal(body.data.id, 2);
});

test('Cache BYPASS: mock get ném lỗi, trả về BYPASS, fromCache=false', async () => {
  // Monkey-patch get để throw
  redis.get = async () => { throw new Error('boom'); };
  const res = await fastify.inject({ method: 'GET', url: '/user/3' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['x-cache'], 'BYPASS');
  const body = JSON.parse(res.body);
  assert.equal(body.fromCache, false);
  assert.equal(body.data.id, 3);
});
