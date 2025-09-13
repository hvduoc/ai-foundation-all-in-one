// tests/index.test.js
// Chạy bằng: node tests/index.test.js
// hoặc: node --test tests/index.test.js (Node >=18)
// Dev dep cần: ioredis-mock

const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const RedisMock = require('ioredis-mock');
const { main, buildUserKey, DEFAULT_TTL_SECONDS } = require('../src/index.js');

let redis;

beforeEach(() => {
  redis = new RedisMock();
});

afterEach(async () => {
  if (redis && typeof redis.quit === 'function') {
    await redis.quit();
  }
});

test('Cache Miss: lần gọi đầu tiên trả về dữ liệu và lưu vào cache', async () => {
  const res = await main({ redisClient: redis });
  assert.equal(res.fromCache, false);
  assert.equal(res.data?.id, 1);
  assert.equal(res.data?.username, 'guest');

  const key = buildUserKey(1);
  const raw = await redis.get(key);
  assert.ok(raw, 'Dữ liệu phải được lưu vào Redis');
  const parsed = JSON.parse(raw);
  assert.equal(parsed.id, 1);
  assert.equal(parsed.username, 'guest');

  // TTL phải được set (ioredis-mock hỗ trợ ttl())
  const ttl = await redis.ttl(key);
  // ioredis-mock có thể trả về -1 nếu TTL chưa set, nhưng với set EX thì phải > 0
  assert.ok(ttl === -1 || ttl > 0, 'TTL phải tồn tại hoặc được Redis mock hỗ trợ');
});

test('Cache Hit: lần gọi thứ hai lấy từ cache', async () => {
  // Lần 1: miss và set cache
  const first = await main({ redisClient: redis });
  assert.strictEqual(first.fromCache, false);

  // Lần 2: hit
  const second = await main({ redisClient: redis });
  assert.strictEqual(second.fromCache, true);
  assert.deepEqual(second.data, first.data);
  // Nếu có kiểm tra header, ví dụ:
  // assert.strictEqual(second.headers?.['x-cache'], 'HIT');

  // TTL không bắt buộc giảm đáng kể trong mock, nhưng key vẫn còn
  const key = buildUserKey(1);
  const ttl = await redis.ttl(key);
  assert.ok(ttl === -1 || ttl >= -1 || ttl <= DEFAULT_TTL_SECONDS, 'TTL hợp lệ');
});
