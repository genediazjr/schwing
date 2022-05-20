import fp from 'fastify-plugin';
import Etag from '@fastify/etag';
import Util from './lib/util.js';
import Email from './lib/email.js';
import Redis from './lib/redis.js';
import Mobile from './lib/mobile.js';
import Pbkdf2 from './lib/pbkdf2.js';
import Postgre from './lib/postgre/index.js';
import Discord, { postToDiscord } from './lib/discord.js';
import Envvars from './lib/envvars.js';
import GeoCode from './lib/geocode.js';
import Corscap from './lib/corscap.js';
import Security from './lib/security.js';
import Pressure from './lib/pressure.js';
import Httpcode from './lib/httpcode.js';
import Indexpage from './lib/indexpage.js';
import Ratelimit from './lib/ratelimit.js';
import Recaptcha from './lib/recaptcha.js';
import Privilege from './lib/privilege.js';
import FileStore from './lib/filestore.js';

async function schwing (fastify, opts) {
  fastify.setErrorHandler(async (error, request, reply) => {
    if (!error.statusCode || (error.statusCode >= 500 &&
      error.message !== 'Internal Server Error')) {
      request.log.error(error);
      await postToDiscord(error);
    }
    if (error.statusCode) {
      reply.status(error.statusCode).send(error);
    } else {
      reply.internalServerError();
    }
  });
  fastify.register(Envvars, opts).after(() => {
    fastify.register(Etag);
    fastify.register(Util, opts);
    fastify.register(Email, opts);
    fastify.register(Redis, opts);
    fastify.register(Mobile, opts);
    fastify.register(Pbkdf2, opts);
    fastify.register(Postgre, opts);
    fastify.register(Discord, opts);
    fastify.register(GeoCode, opts);
    fastify.register(Corscap, opts);
    fastify.register(Security, opts);
    fastify.register(Pressure, opts);
    fastify.register(Httpcode, opts);
    fastify.register(Indexpage, opts);
    fastify.register(Ratelimit, opts);
    fastify.register(Recaptcha, opts);
    fastify.register(Privilege, opts);
    fastify.register(FileStore, opts);
  });
}

export default fp(schwing, {
  name: 'schwing',
  fastify: '>=3.x'
});

export { default as Model } from './lib/postgre/model.js';
export { HashPassword, VerifyPassword } from './lib/pbkdf2.js';
export { Worker, Server, Instance } from './lib/cluster.js';
export {
  IsJSONStr, EachAsync, ResizeDataUri, MakeColumnJSON, TitleCase, GetIp, AggJSONb,
  IsJSONObj, FixMobile, MakeAggObject, MakeSearchQuery, Capitalize, GetAge,
  ToOrdinal, PadString, MakeJSONQuery, ToLowerCaseJSON, ToMonetary, ColFix
} from './lib/util.js';
