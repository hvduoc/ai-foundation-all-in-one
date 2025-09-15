const { test } = require('node:test');
const assert = require('node:assert/strict');
const RedisMock = require('ioredis-mock');

const { main, buildUserKey } = require('../src/index.js');

test('Cache Miss: lần đầu gọi, dữ liệu được trả và lưu cache', async () => {
  const redis = new RedisMock();
  await redis.flushall(); // đảm bảo trống

  const first = await main({ redisClient: redis });

  assert.equal(first.fromCache, false);
  assert.ok(first.data && first.data.id === 1);

  const key = buildUserKey(1);
  const raw = await redis.get(key);
  assert.ok(raw, 'key phải được set vào cache');
});

test('Cache Hit: lần gọi thứ 2 lấy từ cache', async () => {
  const redis = new RedisMock();
  await redis.flushall(); // đảm bảo trống

  const first = await main({ redisClient: redis });
  assert.equal(first.fromCache, false); // lần 1 phải MISS

  const second = await main({ redisClient: redis });
  assert.equal(second.fromCache, true); // lần 2 phải HIT
});
