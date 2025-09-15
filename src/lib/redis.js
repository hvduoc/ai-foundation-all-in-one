/**
 * src/lib/redis.js
 * Redis singleton (Upstash TLS) + ioredis-mock cho Test/CI, key prefix, JSON helpers.
 */
const DEFAULT_TTL_SECONDS = Number(process.env.USER_CACHE_TTL || 300);
const KEY_PREFIX = process.env.KEY_PREFIX || '';

// Dùng mock khi:
// - NODE_ENV === 'test'  hoặc
// - CI === 'true'        hoặc
// - REDIS_MOCK === 'true'
const IS_MOCK =
  process.env.NODE_ENV === 'test' ||
  process.env.CI === 'true' ||
  process.env.REDIS_MOCK === 'true';

let _client = null;

function createClient() {
  if (IS_MOCK) {
    // ioredis-mock API tương thích với ioredis
    const IORedisMock = require('ioredis-mock');
    return new IORedisMock();
  }

  // Production/dev: dùng ioredis + TLS (nếu rediss://)
  const Redis = require('ioredis');
  const url = process.env.REDIS_URL;

  if (!url) {
    throw new Error(
      'REDIS_URL is required in non-test environments (hoặc set REDIS_MOCK=true để dùng mock).'
    );
  }

  const isTLS = url.startsWith('rediss://');
  const hostname = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return undefined;
    }
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
  // Với ioredis-mock: không cần connect()
  if (!IS_MOCK && typeof _client.connect === 'function') {
    _client.connect().catch(() => {
      /* Cho phép handler phía trên BYPASS nếu lỗi kết nối */
    });
  }
  return _client;
}

function buildKey(key) {
  if (!KEY_PREFIX) return key;
  return key.startsWith(KEY_PREFIX) ? key : KEY_PREFIX + key;
}

// Các helper JSON
async function getJson(client, key) {
  const raw = await client.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function setJson(client, key, value, ttlSec = DEFAULT_TTL_SECONDS) {
  const payload = JSON.stringify(value);
  await client.set(key, payload, 'EX', Number(ttlSec) || DEFAULT_TTL_SECONDS);
}

async function disconnect() {
  if (_client && typeof _client.quit === 'function') {
    try {
      await _client.quit();
    } catch {
      /* noop */
    }
  }
  _client = null;
}

module.exports = {
  DEFAULT_TTL_SECONDS,
  KEY_PREFIX,
  IS_MOCK,
  getRedis,
  buildKey,
  getJson,
  setJson,
  disconnect,
};
