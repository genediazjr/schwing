import fp from 'fastify-plugin';
import RateLimit from '@fastify/rate-limit';
import Redis from 'ioredis';

async function ratelimit (fastify, opts = {}) {
  const { config } = fastify;
  const rateConf = {
    max: config.RATE_MAX,
    timeWindow: config.RATE_WINDOW,
    ...opts.ratelimit
  };

  if (config.NODE_ENV !== 'test') {
    rateConf.redis = new Redis(config.REDIS_CONNSTR, {
      connectTimeout: 500,
      maxRetriesPerRequest: 1
    });
  }

  fastify.register(RateLimit, rateConf);
}

export default fp(ratelimit, { name: 'ratelimit' });
