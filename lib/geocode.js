import fp from 'fastify-plugin';
import { Client } from '@googlemaps/google-maps-services-js';

async function geoCode (fastify) {
  const { config, redis } = fastify;
  if (!config.GEOCODING_KEY) {
    return;
  }

  const client = new Client();
  fastify.decorate('geoCode', getCoords);

  async function getCoords (address) {
    try {
      const key = `geocode:${address}`;
      let coords = await redis.get(key);
      if (coords) {
        coords = JSON.parse(coords);
      } else {
        const res = await client.geocode({
          params: {
            key: config.GEOCODING_KEY,
            address: `${address} ${config.GEOCODING_COUNTRY || ''}`
          }
        });
        coords = res.data.results[0];
        if (coords) {
          await redis.set(key, JSON.stringify(coords));
        }
      }
      return coords;
    } catch (err) {
      fastify.log.info(`geoCode ${err}`);
    }
  }
}

export default fp(geoCode, {
  name: 'geoCode',
  dependencies: ['redis']
});
