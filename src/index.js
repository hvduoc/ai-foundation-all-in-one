// src/index.js
const Redis = require('ioredis');
const Fastify = require('fastify');
const userRoute = require('./routes/user');

const DEFAULT_TTL_SECONDS = Number(process.env.USER_CACHE_TTL || 60);

function buildUserKey(id) { return `user:${id}`; }

function createRedisClient() {
  const url = process.env.REDIS_URL;
  if (url) return new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 2 });
  const host = process.env.REDIS_HOST || '127.0.0.1';
  const port = Number(process.env.REDIS_PORT || 6379);
  return new Redis({ host, port, lazyConnect: true, maxRetriesPerRequest: 2 });
}

// Core phục vụ test/DI (giữ nguyên cho unit test)
async function main({ redisClient } = {}) {
  let client = redisClient;
  let createdHere = false;
  try {
    if (!client) {
      client = createRedisClient();
      createdHere = true;
      await client.connect?.();
    }
    const userId = 1;
    const key = buildUserKey(userId);
    const cached = await client.get(key);
    if (cached) {
      try { return { fromCache: true, data: JSON.parse(cached) }; } catch {}
    }
    const user = { id: 1, username: 'guest', role: 'viewer', createdAt: new Date().toISOString() };
    await client.set(key, JSON.stringify(user), 'EX', DEFAULT_TTL_SECONDS);
    return { fromCache: false, data: user };
  } finally {
    if (createdHere && client?.quit) await client.quit();
  }
}

async function start() {
  const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
  const PORT = Number(process.env.PORT || 3000);
  const HOST = '127.0.0.1'; // khóa loopback cho ổn định

  const fastify = Fastify({ logger: { level: LOG_LEVEL } });

  // Health & diag
  fastify.get('/__alive', async () => ({ ok: true, t: Date.now() }));
  fastify.get('/__diag', async () => ({
    pid: process.pid,
    cwd: process.cwd(),
    time: Date.now(),
    routes: fastify.printRoutes()
  }));

  // Mount /api
  await fastify.register(userRoute, { prefix: '/api' });

  // Bắt lỗi toàn cục để không “chết câm”
  process.on('uncaughtException', (err) => {
    fastify.log.error({ evt: 'uncaughtException', err: err?.stack || String(err) });
    process.exit(1);
  });
  process.on('unhandledRejection', (reason) => {
    fastify.log.error({ evt: 'unhandledRejection', reason: reason?.stack || String(reason) });
    process.exit(1);
  });

  await fastify.listen({ port: PORT, host: HOST });
  fastify.log.info(`Server listening on http://${HOST}:${PORT}`);
  fastify.log.info('=== ROUTES ===\n' + fastify.printRoutes());

  return fastify;
}

if (require.main === module) {
  start().catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { main, createRedisClient, buildUserKey, DEFAULT_TTL_SECONDS, start };
