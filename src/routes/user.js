const { performance } = require('node:perf_hooks');
const {
  getRedis,
  buildKey,
  getJson,
  setJson,
  DEFAULT_TTL_SECONDS,
} = require('../lib/redis');
const { fetchUserFromDB, sanitizeId } = require('../services/userService');

module.exports = async function userRoutes(fastify) {
  fastify.get('/user/:id', async (req, reply) => {
    const t0 = performance.now();
    const id = sanitizeId(req.params.id);

    // Ưu tiên mock đã inject trong test; prod dùng singleton
    const client = fastify.redis ?? getRedis();

    try {
      const key = buildKey(`user:${id}`);
      const cached = await getJson(client, key);

      if (cached) {
        reply.header('X-Cache', 'HIT');
        fastify.log?.info?.({ evt: 'cache_hit', user_id: id, ms: performance.now() - t0 });
        return { fromCache: true, data: cached };
      }

      const data = await fetchUserFromDB(id);
      await setJson(client, key, data, DEFAULT_TTL_SECONDS);

      reply.header('X-Cache', 'MISS');
      fastify.log?.info?.({ evt: 'cache_miss', user_id: id, ms: performance.now() - t0 });
      return { fromCache: false, data };
    } catch (err) {
      const safeId = Number(id || 0) || 0;
      const data = await fetchUserFromDB(safeId);
      reply.header('X-Cache', 'BYPASS');
      fastify.log?.error?.({ evt: 'cache_error', user_id: safeId, err: err?.message });
      return { fromCache: false, data };
    }
  });
};
