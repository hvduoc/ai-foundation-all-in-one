// src/lib/redis.js
// Runtime Redis client with optional mock for local dev.
// Usage: set USE_REDIS_MOCK=1 to use in-memory mock (no real Redis needed).

const useMock = process.env.USE_REDIS_MOCK === '1' || process.env.REDIS_URL === 'mock:';

let RedisCtor;
try {
  RedisCtor = useMock ? require('ioredis-mock') : require('ioredis');
} catch (e) {
  // Fallback: if ioredis-mock not installed but requested, throw clear error
  if (useMock) {
    throw new Error('USE_REDIS_MOCK=1 but ioredis-mock is not installed. Run: pnpm add -D ioredis-mock');
  }
  throw e;
}

const DEFAULT_TTL_SECONDS = Number(process.env.USER_CACHE_TTL || 60);

function createRedisClient() {
  if (useMock) {
    return new RedisCtor(); // in-memory
  }
  const url = process.env.REDIS_URL;
  if (url) return new RedisCtor(url, { lazyConnect: true, maxRetriesPerRequest: 2 });
  const host = process.env.REDIS_HOST || '127.0.0.1';
  const port = Number(process.env.REDIS_PORT || 6379);
  return new RedisCtor({ host, port, lazyConnect: true, maxRetriesPerRequest: 2 });
}

function buildUserKey(id) { return `user:${id}`; }

async function getJson(client, key) {
  const raw = await client.get(key);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

async function setJson(client, key, obj, ttlSec = DEFAULT_TTL_SECONDS) {
  await client.set(key, JSON.stringify(obj), 'EX', ttlSec);
}

module.exports = {
  DEFAULT_TTL_SECONDS,
  createRedisClient,
  buildUserKey,
  getJson,
  setJson,
};
