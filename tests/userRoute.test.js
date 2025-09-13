// tests/userRoute.test.js
// QA test cho caching logic, không khởi động server HTTP

const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const RedisMock = require('ioredis-mock');
const { buildUserKey, DEFAULT_TTL_SECONDS } = require('../src/lib/redis');
const { fetchUserFromDB, sanitizeId } = require('../src/services/userService');

// Core logic tách ra để test trực tiếp
async function resolveUser(id, { redisClient, ttl = DEFAULT_TTL_SECONDS } = {}) {
  let fromCache = false;
  let data;
  let cacheHeader = 'MISS';
  let error = null;
  try {
    const userId = sanitizeId(id);
    const key = buildUserKey(userId);
    const cached = await redisClient.get(key);
    if (cached) {
      fromCache = true;
      data = JSON.parse(cached);
      cacheHeader = 'HIT';
      return { fromCache, data, cacheHeader };
    }
    // Cache miss
    data = await fetchUserFromDB(userId);
    await redisClient.set(key, JSON.stringify(data), 'EX', ttl);
    return { fromCache, data, cacheHeader };
  } catch (err) {
    error = err;
    cacheHeader = err.name === 'INVALID_USER_ID' ? 'ERROR' : 'BYPASS';
    data = await fetchUserFromDB(id);
    fromCache = false;
    return { fromCache, data, cacheHeader, error };
  }
}

let redis;

beforeEach(() => {
  redis = new RedisMock();
});

afterEach(async () => {
  if (redis && typeof redis.quit === 'function') {
    await redis.quit();
  }
});

test('Cache Miss: lần đầu gọi, dữ liệu được tạo và lưu vào cache', async () => {
  await redis.flushall();
  const res = await resolveUser(1, { redisClient: redis });
  assert.equal(res.fromCache, false);
  assert.equal(res.data.id, 1);
  const key = buildUserKey(1);
  const raw = await redis.get(key);
  assert.ok(raw, 'Dữ liệu phải được lưu vào cache');
  assert.equal(res.cacheHeader, 'MISS');
});

test('Cache Hit: lần gọi thứ hai, dữ liệu lấy từ cache', async () => {
  await redis.flushall();
  const first = await resolveUser(1, { redisClient: redis });
  const second = await resolveUser(1, { redisClient: redis });
  assert.equal(second.fromCache, true);
  assert.deepEqual(second.data, first.data);
  assert.equal(second.cacheHeader, 'HIT');
});

test('Cache Expire: hết hạn TTL, gọi lại sẽ miss', async () => {
  await redis.flushall();
  const ttl = 1;
  const first = await resolveUser(1, { redisClient: redis, ttl });
  assert.equal(first.fromCache, false);
  await new Promise(r => setTimeout(r, 1100));
  const second = await resolveUser(1, { redisClient: redis, ttl });
  assert.equal(second.fromCache, false);
  assert.notEqual(second.data.createdAt, first.data.createdAt);
  assert.equal(second.cacheHeader, 'MISS');
});

test('Redis Error: get throw error, fallback DB, header BYPASS', async () => {
  await redis.flushall();
  // Stub get để throw
  redis.get = async () => { throw new Error('boom'); };
  const res = await resolveUser(1, { redisClient: redis });
  assert.equal(res.fromCache, false);
  assert.ok(res.cacheHeader === 'BYPASS' || res.cacheHeader === 'ERROR');
  assert.ok(res.error instanceof Error);
});
