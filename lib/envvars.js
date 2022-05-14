import fp from 'fastify-plugin';
import Env from '@fastify/env';
import S from 'fluent-json-schema';
const defaultVars = {
  NODE_ENV: S.string().required(),
  PAGE_TITLE: S.string().required(),
  ROUTE_PREFIX: S.string().required(),
  CACHE_EXPIRES: S.number(),
  REDIS_CONNSTR: S.string().required(),
  POSTGRE_CONNSTR: S.string().required(),
  AWS_ACCESS_KEY_ID: S.string().required(),
  AWS_SECRET_ACCESS_KEY: S.string().required(),
  S3_BUCKET: S.string(),
  S3_PREFIX: S.string(),
  S3_REGION: S.string(),
  EMAIL_FROM: S.string().required(),
  EMAIL_REGION: S.string().required(),
  MOBILE_REGION: S.string().required(),
  MASK_MOBILE: S.number(),
  SMS_SPENDING_LIMIT: S.number(),
  GEOCODING_COUNTRY: S.string(),
  GEOCODING_KEY: S.string(),
  RECAPTCHA_KEY: S.string().required(),
  RATE_WINDOW: S.string().default('1 minute'),
  RATE_MAX: S.number().default(100),
  PBKDF2_ENCODING: S.string().default('base64'),
  PBKDF2_DIGEST: S.string().default('sha512'),
  PBKDF2_HASHBYTES: S.number().default(32),
  PBKDF2_SALTBYTES: S.number().default(16),
  PBKDF2_ITERATIONS: S.number().default(872791),
  COOKIESECRET_LEN: S.number().default(42),
  COOKIESECRET: S.string(),
  CSRFCOOKIE_NAME: S.string().required(),
  UIDCOOKIE_NAME: S.string().required(),
  JWTCOOKIE_NAME: S.string().required(),
  JWTSECRET_LEN: S.number().default(42),
  JWTSECRET: S.string(),
  ASSETSRC_DEV: S.string(),
  ASSETSRC: S.string(),
  DOMAIN: S.string(),
  STYLES1: S.string(),
  STYLES2: S.string(),
  SCRIPTS1: S.string(),
  SCRIPTS2: S.string(),
  SCRIPTS0: S.string(),
  MAX_RSSBYTES: S.number(),
  MAX_HEAPBYTES: S.number(),
  MAX_EVENTUTIL: S.number(),
  MAX_EVENTDELAY: S.number(),
  META_KEYWORDS: S.string(),
  META_DESCRIPTION: S.string(),
  META_OG_TITLE: S.string(),
  META_OG_DESCRIPTION: S.string(),
  META_OG_IMAGE: S.string(),
  META_OG_URL: S.string(),
  META_TWITTER_CARD: S.string(),
  DISCORD_ERRORHOOK: S.string()
};

async function envvars (fastify, opts = {}) {
  const envVars = { ...defaultVars, ...opts.envvars };
  let schema = S.object();
  for (const key in envVars) {
    schema = schema.prop(key, envVars[key]);
  }
  const regOpts = {
    dotenv: opts.dotenv || { path: `${process.cwd()}/.env` },
    schema: schema.valueOf()
  };
  if (opts.dotenv === false) {
    delete regOpts.dotenv;
  }
  await fastify.register(Env, regOpts);
}

export default fp(envvars, { name: 'envvars' });
