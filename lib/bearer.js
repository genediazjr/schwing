
import fp from 'fastify-plugin';
import Bearer from '@fastify/bearer-auth';

async function bearer (fastify, opts = {}) {
  const { NODE_ENV, BEARER_KEYS } = fastify.config;
  if (NODE_ENV === 'test') {
    fastify.decorate('verifyBearerAuth', Function.prototype);
    return;
  }

  if (opts.bearer || BEARER_KEYS) {
    fastify.register(Bearer, opts.bearer || {
      keys: BEARER_KEYS.split(','),
      addHook: false
    });
    fastify.decorateRequest('getBearerToken', function () {
      return this.headers.authorization.replace(/bearer /i, '');
    });
  }
}

export default fp(bearer, { name: 'bearer' });
