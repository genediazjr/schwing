import fp from 'fastify-plugin';
import Jwt from '@fastify/jwt';
import Csrf from '@fastify/csrf-protection';
import Cookie from '@fastify/cookie';
import CryptRandStr from 'crypto-random-string';
import { GetIp } from './util.js';

async function security (fastify, opts) {
  const { config, postToDiscord } = fastify;
  const { NODE_ENV, CSRFCOOKIE_NAME, JWTCOOKIE_NAME, UIDCOOKIE_NAME } = config;
  const secure = NODE_ENV && NODE_ENV.startsWith('prod');
  const csrf = `X-${CSRFCOOKIE_NAME}`;
  const noop = async (request, userObj, keep) => userObj;
  const auth = opts.authenHook || noop;
  const sess = opts.sessionHook || noop;
  const maxAge = opts.tagMaxAge || 86400 * 365 * 10;
  const getCsrf = req => req.headers[csrf] || req.headers[csrf.toLowerCase()];
  const getCookie = (req, name) => req.unsignCookie(req.cookies[name] || '');
  const cookieOpts = {
    samesite: 'strict',
    httpOnly: true,
    secure: secure,
    signed: true,
    path: '/'
  };

  let jwtSecret = 'foobar';
  let cookieSecret = 'foobar';
  if (secure) {
    jwtSecret = CryptRandStr({
      type: 'base64', length: config.JWTSECRET_LEN
    });
    cookieSecret = CryptRandStr({
      type: 'base64', length: config.COOKIESECRET_LEN
    });
  }

  fastify.register(Cookie, {
    secret: config.COOKIESECRET || cookieSecret
  });

  fastify.register(Jwt, {
    secret: config.JWTSECRET || jwtSecret,
    cookie: {
      signed: true,
      cookieName: JWTCOOKIE_NAME
    }
  });

  fastify.register(Csrf, {
    cookieOpts: cookieOpts,
    cookieKey: CSRFCOOKIE_NAME,
    getToken: getCsrf,
    getUserInfo: req => (req.user && req.user.id) ||
      getCookie(req, UIDCOOKIE_NAME).value
  });

  fastify.decorateReply('failed', repFailed);
  fastify.decorateRequest('failed', reqFailed);
  fastify.decorateRequest('getUid', getUid);
  fastify.decorateRequest('getIp', getIp);
  fastify.decorate('authenticate', authenticate);
  fastify.decorate('session', session);
  fastify.decorate('logout', logout);
  if (NODE_ENV !== 'test') {
    fastify.addHook('onRequest', onRequest);
  }

  function getIp () {
    return GetIp(this);
  }

  function getUid () {
    return this.unsignCookie(this.cookies[UIDCOOKIE_NAME]).value;
  }

  function reqFailed (err, obj) {
    this.log.error(`${this.method} ${this.url} from ${GetIp(this)} failed:`);
    this.log.error(`${getCookie(this, UIDCOOKIE_NAME).value} ${this.user && this.user.id}`);
    this.log.error(obj);
    this.log.error(err);
  }

  function repFailed (request, err, obj, opts = {}) {
    if (Array.isArray(opts.constraints)) {
      let message;
      opts.constraints.forEach(u => {
        if (!message && err.message.includes(u.key)) {
          message = u.message;
        }
      });
      if (message) {
        return this.badRequest(message);
      }
    }
    request.log.error(`${request.method} ${request.url} from ${GetIp(request)} failed:`);
    request.log.error(`${getCookie(request, UIDCOOKIE_NAME).value} ${request.user && request.user.id}`);
    request.log.error(obj);
    request.log.error(err);
    this.internalServerError();
    (async () => await postToDiscord(err))();
  }

  async function logout (request, reply) {
    const userInfo = getCookie(request, UIDCOOKIE_NAME).value;
    reply
      .header(csrf, await reply.generateCsrf({ userInfo }))
      .clearCookie(JWTCOOKIE_NAME)
      .ok();
  }

  async function session (request, reply, userObj) {
    const hooked = await sess(request, userObj);
    const token = await reply.jwtSign(hooked);
    const cookieOpt = { ...cookieOpts };
    if (userObj.remember) {
      cookieOpt.maxAge = opts.sessionAge || 60 * 60 * 24 * 30;
    }
    reply
      .header(csrf, await reply.generateCsrf({ userInfo: hooked.id }))
      .setCookie(JWTCOOKIE_NAME, token, cookieOpt);
  }

  async function authenticate (request, reply) {
    const userInfo = getCookie(request, UIDCOOKIE_NAME).value;
    try {
      await request.jwtVerify();
      await auth(request, reply);
    } catch (err) {
      fastify.log.info(`${request.ip} ${err}`);
      if (typeof userInfo === 'string') {
        return reply
          .header(csrf, await reply.generateCsrf({ userInfo }))
          .clearCookie(JWTCOOKIE_NAME)
          .unauthorized();
      }
      reply
        .clearCookie(JWTCOOKIE_NAME)
        .unauthorized();
    }
  }

  async function onRequest (request, reply) {
    if (request.context.config.nocsrf) {
      return;
    }
    let uid = getCookie(request, UIDCOOKIE_NAME);
    if (!uid || !uid.valid) {
      uid = CryptRandStr({ length: opts.tagLength || 30, type: 'ascii-printable' });
      reply.setCookie(UIDCOOKIE_NAME, `${uid}${Date.now()}`, { ...cookieOpts, maxAge });
    }
    if (request.cookies[JWTCOOKIE_NAME]) {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.clearCookie(JWTCOOKIE_NAME);
      }
    }

    const userInfo =
      (request.user && request.user.id) ||
      (uid.value || uid);

    if (request.method === 'GET' && getCsrf(request) === '') {
      reply.header(csrf, await reply.generateCsrf({ userInfo }));
    }
    if (['POST', 'PUT', 'DELETE'].includes(request.method)) {
      fastify.csrfProtection(request, reply, Function.prototype);
    }
  }
}

export default fp(security, {
  name: 'security',
  dependencies: ['discord']
});
