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
      if (Array.isArray(data.embeds)) {
        await axios({ method: 'post', url, data });
      } else {
        await axios({
          method: 'post',
          url,
          data: {
            embeds: [{
              title: process.env.DOMAIN || 'localhost',
              description: `\`\`\`${data.stack}\`\`\``
            }]
          }
        });
      }
    }
  } catch (err) {
    console.error(`postToDiscord err ${err}`);
    console.error(err.stack);
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
