// src/plugins/userRoute.js
// Fastify plugin cho GET /api/user/:id với caching Redis

const {
  createRedisClient,
  buildUserKey,
  getJson,
  setJson,
  DEFAULT_TTL_SECONDS,
} = require('../lib/redis');
const { fetchUserFromDB, sanitizeId } = require('../services/userService');
const { performance } = require('perf_hooks');

async function userRoute(fastify, opts) {
  fastify.route({
    method: 'GET',
    url: '/api/user/:id',
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            fromCache: { type: 'boolean' },
            data: { type: 'object' },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const { id } = request.params;
      let client;
      let createdHere = false;
      let fromCache = false;
      let data;
      let cacheHeader = 'MISS';
      const start = performance.now();
      try {
        const userId = sanitizeId(id);
        client = createRedisClient();
        createdHere = true;
        if (typeof client.connect === 'function') {
          await client.connect();
        }
        const key = buildUserKey(userId);
        const cached = await getJson(client, key);
        if (cached) {
          fromCache = true;
          data = cached;
          cacheHeader = 'HIT';
          reply.header('X-Cache', cacheHeader);
          fastify.log.info({ evt: 'cache_hit', user_id: userId, duration_ms: +(performance.now() - start).toFixed(2) });
          return { fromCache, data };
        }
        // Cache miss
        data = await fetchUserFromDB(userId);
        await setJson(client, key, data, DEFAULT_TTL_SECONDS);
        reply.header('X-Cache', cacheHeader);
        fastify.log.info({ evt: 'cache_miss', user_id: userId, duration_ms: +(performance.now() - start).toFixed(2) });
        return { fromCache, data };
      } catch (err) {
        // Redis hoặc logic lỗi
        cacheHeader = err.name === 'INVALID_USER_ID' ? 'ERROR' : 'BYPASS';
        reply.header('X-Cache', cacheHeader);
        fastify.log.error({ evt: 'cache_error', error: err.message });
        data = await fetchUserFromDB(id);
        fromCache = false;
        return { fromCache, data };
      } finally {
        if (createdHere && client && typeof client.quit === 'function') {
          await client.quit();
        }
      }
    },
  });
}

module.exports = userRoute;
