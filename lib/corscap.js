import fp from 'fastify-plugin';
import Cors from '@fastify/cors';
import Helmet from '@fastify/helmet';
const cspProps = ['connectSrc', 'scriptSrc', 'styleSrc', 'frameSrc', 'fontSrc', 'imgSrc'];
const checkPath = (path, prop) => {
  if (path.endsWith('/')) {
    throw new Error(`CSP ${prop} cannot end with a slash`);
  }
  if (path.split('.').pop().includes('/')) {
    throw new Error(`CSP ${prop} must end with a domain extension`);
  }
};

async function corscap (fastify, opts = {}) {
  cspProps.forEach(prop => {
    if (Array.isArray(opts[prop])) {
      opts[prop].forEach(path => checkPath(path, prop));
    }
  });

  const { config } = fastify;
  const { NODE_ENV, ASSETSRC, ASSETSRC_DEV } = config;
  const policy = {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        connectSrc: [
          "'self'",
          'https://*.google.com',
          'https://*.gstatic.com',
          'https://*.googleapis.com',
          ...opts.connectSrc || []
        ],
        scriptSrc: [
          "'self'",
          'https://*.google.com',
          'https://*.gstatic.com',
          'https://*.googleapis.com',
          ...opts.scriptSrc || []
        ],
        styleSrc: [
          "'self'",
          'https://*.google.com',
          'https://*.gstatic.com',
          'https://*.googleapis.com',
          ...opts.styleSrc || []
        ],
        frameSrc: [
          "'self'",
          'https://*.google.com',
          'https://*.gstatic.com',
          'https://*.googleapis.com',
          ...opts.frameSrc || []
        ],
        fontSrc: [
          "'self'",
          'https://*.google.com',
          'https://*.gstatic.com',
          'https://*.googleapis.com',
          ...opts.fontSrc || []
        ],
        imgSrc: [
          "'self'",
          'data:',
          'https://*.google.com',
          'https://*.gstatic.com',
          'https://*.googleapis.com',
          ...opts.imgSrc || []
        ],
        objectSrc: [
          ...opts.objectSrc || ["'none'"]
        ],
        childSrc: [
          "'self'",
          ...opts.childSrc || []
        ],
        workerSrc: [
          "'self'",
          ...opts.workerSrc || []
        ],
        manifestSrc: [
          "'self'",
          ...opts.manifestSrc || []
        ],
        mediaSrc: [
          "'self'",
          ...opts.mediaSrc || []
        ],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        scriptSrcAttr: ["'none'"],
        frameAncestors: ["'none'"],
        blockAllMixedContent: [],
        upgradeInsecureRequests: []
      }
    }
  };

  if (ASSETSRC) {
    if (!ASSETSRC.includes('localhost')) {
      checkPath(ASSETSRC, 'ASSETSRC');
    }
    policy.contentSecurityPolicy.directives.connectSrc.push(ASSETSRC);
    policy.contentSecurityPolicy.directives.workerSrc.push(ASSETSRC);
    policy.contentSecurityPolicy.directives.scriptSrc.push(ASSETSRC);
    policy.contentSecurityPolicy.directives.styleSrc.push(ASSETSRC);
    policy.contentSecurityPolicy.directives.mediaSrc.push(ASSETSRC);
    policy.contentSecurityPolicy.directives.childSrc.push(ASSETSRC);
    policy.contentSecurityPolicy.directives.fontSrc.push(ASSETSRC);
    policy.contentSecurityPolicy.directives.imgSrc.push(ASSETSRC);
  }
  if (NODE_ENV && NODE_ENV.startsWith('dev')) {
    policy.crossOriginEmbedderPolicy = false;
    policy.crossOriginResourcePolicy = false;
    policy.crossOriginOpenerPolicy = false;
    if (ASSETSRC_DEV) {
      checkPath(ASSETSRC_DEV, 'ASSETSRC_DEV');
      policy.contentSecurityPolicy.directives.imgSrc.push(ASSETSRC_DEV);
    }
  }
  if (!opts.nonce) {
    policy.contentSecurityPolicy.directives.styleSrc.push("'unsafe-inline'");
  } else {
    policy.enableCSPNonces = true;
  }
  if (opts.cors) {
    fastify.register(Cors);
  }
  fastify.register(Helmet, { ...policy, ...opts.policy });
}

export default fp(corscap, { name: 'corscap' });
