import fp from 'fastify-plugin';
import Redis from '@fastify/redis';

async function redis (fastify) {
  const cfg = fastify.config;
  if (cfg.NODE_ENV === 'test') {
    fastify.decorate('redis', {});
    return;
  }

  fastify.register(Redis, { url: cfg.REDIS_CONNSTR });
}

export default fp(redis, { name: 'redis' });
