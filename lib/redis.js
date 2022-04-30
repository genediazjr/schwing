import fp from 'fastify-plugin';
import Redis from 'ioredis';

async function redis (fastify) {
  const cfg = fastify.config;
  if (cfg.NODE_ENV === 'test') {
    fastify.decorate('redis', {});
    return;
  }

  try {
    const client = new Redis(cfg.REDIS_CONNSTR);

    fastify
      .decorate('redis', client)
      .addHook('onClose', (instance, done) => {
        instance.redis.quit(done);
        delete instance.redis;
      });
  } catch (err) {
    throw new Error(err);
  }
}

export default fp(redis, { name: 'redis' });
