import fp from 'fastify-plugin';
import UnderPressure from '@fastify/under-pressure';

async function pressure (fastify, opts = {}) {
  const cfg = fastify.config;
  fastify.register(UnderPressure, {
    maxEventLoopUtilization: opts.maxEventLoopUtilization || cfg.MAX_EVENTUTIL,
    maxEventLoopDelay: opts.maxEventLoopDelay || cfg.MAX_EVENTDELAY,
    maxHeapUsedBytes: opts.maxHeapUsedBytes || cfg.MAX_HEAPBYTES,
    maxRssBytes: opts.maxRssBytes || cfg.MAX_RSSBYTES
  });
}

export default fp(pressure, { name: 'pressure' });
