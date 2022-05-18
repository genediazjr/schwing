import fp from 'fastify-plugin';
import axios from 'axios';

export const postToDiscord = async (hook, payload) => {
  try {
    const data = payload || hook;
    let url = process.env.DISCORD_ERRORHOOK;
    if (hook && payload) {
      url = hook;
    }
    if (url) {
      await axios({ method: 'post', url, data });
    }
  } catch (err) {
    console.error(`postToDiscord err ${err}`);
  }
};

async function discord (fastify) {
  const { config } = fastify;
  fastify.decorate('postToDiscord',
    config.NODE_ENV === 'test'
      ? Function.prototype
      : postToDiscord);
}

export default fp(discord, { name: 'discord' });
