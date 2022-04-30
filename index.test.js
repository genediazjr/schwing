import { test } from 'tap';
import colada from 'pino-colada';
import assert from 'supertest';
import fastify from 'fastify';
import plugin, {
  Model, HashPassword,
  GetIp, VerifyPassword,
  FixMobile, MakeSearchQuery
} from './index.js';

process.env.NODE_ENV = 'test';
process.env.PAGE_TITLE = 'test';
process.env.ROUTE_PREFIX = 'test';
process.env.REDIS_CONNSTR = 'test';
process.env.POSTGRE_CONNSTR = 'test';
process.env.AWS_ACCESS_KEY_ID = 'test';
process.env.AWS_SECRET_ACCESS_KEY = 'test';
process.env.EMAIL_FROM = 'test';
process.env.EMAIL_REGION = 'test';
process.env.MOBILE_REGION = 'test';
process.env.RECAPTCHA_KEY = 'test';
process.env.CSRFCOOKIE_NAME = 'test';
process.env.UIDCOOKIE_NAME = 'test';
process.env.JWTCOOKIE_NAME = 'test';

test('runs when registered', async t => {
  const app = fastify({
    ignoreTrailingSlash: true,
    trustProxy: true,
    logger: {
      level: 'info',
      prettyPrint: true,
      prettifier: colada
    }
  });

  await app.register(plugin, { privilegeCheck: true });
  t.teardown(app.close.bind(app));

  app.route({
    method: 'GET',
    path: '/',
    handler: async (request, reply) => {
      reply.send('ok');
    }
  });

  t.ok(app.pbkdf2);
  t.ok(app.getIp);
  t.ok(app.fixMobile);
  t.ok(app.makeSearchQuery);
  t.ok(MakeSearchQuery);
  t.ok(VerifyPassword);
  t.ok(HashPassword);
  t.ok(FixMobile);
  t.ok(GetIp);
  t.ok(Model);

  const hashed = HashPassword('foobar');
  t.ok(VerifyPassword('foobar', hashed));
  t.notOk(VerifyPassword('bar', hashed));

  await app.ready();
  await assert(app.server)
    .get('/')
    .expect(200);
});
