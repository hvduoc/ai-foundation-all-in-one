/**
 * src/lib/redis.js
 * Redis singleton (Upstash TLS), key prefix, JSON helpers.
 */
const Redis = require('ioredis');

const DEFAULT_TTL_SECONDS = Number(process.env.USER_CACHE_TTL || 300);
const KEY_PREFIX = process.env.KEY_PREFIX || '';

let _client = null;

function createClient() {
  const url = process.env.REDIS_URL;
  if (!url) {
    // Cho phép chạy local/dev không có REDIS_URL (test sẽ inject mock thay vì gọi client này)
    return new Redis({
      host: '127.0.0.1',
      port: 6379,
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
      reconnectOnError: () => false,
    });
  }
  const isTLS = url.startsWith('rediss://');
  const hostname = (() => {
    try { return new URL(url).hostname; } catch { return undefined; }
  })();

  return new Redis(url, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
    reconnectOnError: () => false,
    tls: isTLS ? { servername: hostname } : undefined,
  });
}

function getRedis() {
  if (_client) return _client;
  _client = createClient();
  // ioredis v5 có connect(); v4 tự connect
  if (typeof _client.connect === 'function') {
    _client.connect().catch(() => {/* để handler tự BYPASS nếu lỗi */});
  }
  return _client;
}

function buildKey(key) {
  if (!KEY_PREFIX) return key;
  return key.startsWith(KEY_PREFIX) ? key : KEY_PREFIX + key;
}

// Các helper JSON: key truyền vào đã là FULL KEY (đã buildKey)
async function getJson(client, key) {
  const raw = await client.get(key);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

async function setJson(client, key, value, ttlSec = DEFAULT_TTL_SECONDS) {
  const payload = JSON.stringify(value);
  await client.set(key, payload, 'EX', Number(ttlSec) || DEFAULT_TTL_SECONDS);
}

module.exports = {
  DEFAULT_TTL_SECONDS,
  KEY_PREFIX,
  getRedis,
  buildKey,
  getJson,
  setJson,
};
