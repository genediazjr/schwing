import fp from 'fastify-plugin';
import knex from 'knex';
import { querySchema } from './model.js';

async function postgre (fastify, opts = {}) {
  const { config } = fastify;
  fastify.decorate('querySchema', querySchema);

  if (config.NODE_ENV === 'test') {
    const client = {};
    for (const key in opts.models) {
      const Model = opts.models[key];
      client[key] = new Model(client);
    }
    fastify.decorate('postgre', client);
    return;
  }

  try {
    const client = knex({
      client: 'pg',
      connection: config.POSTGRE_CONNSTR
    });

    for (const key in opts.models) {
      const Model = opts.models[key];
      client[key] = new Model(client);
    }

    fastify
      .decorate('postgre', client)
      .addHook('onClose', (instance, done) => {
        instance.postgre.destroy();
        delete instance.postgre;
        done();
      });
  } catch (err) {
    throw new Error(err);
  }
}

export default fp(postgre, { name: 'postgre' });
