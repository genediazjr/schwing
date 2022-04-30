import fp from 'fastify-plugin';
import axios from 'axios';

async function discord (fastify, opts = {}) {
  const { config } = fastify;
  fastify.decorate('postToDiscord',
    config.NODE_ENV === 'test'
      ? Function.prototype
      : postToDiscord);

  async function postToDiscord (hook, payload) {
    try {
      const data = payload || hook;
      let url = opts.discordhook;
      if (hook && payload) {
        url = hook;
      }
      if (url) {
        await axios({ method: 'post', url, data });
      }
    } catch (err) {
      fastify.log.info(`postToDiscord err ${err}`);
    }
  }
}

export default fp(discord, { name: 'discord' });
