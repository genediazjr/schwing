import fp from 'fastify-plugin';

async function indexPage (fastify, opts = {}) {
  const { config } = fastify;
  const {
    META_OG_URL, SPLASH_IMAGE, ROUTE_PREFIX,
    META_OG_TITLE, META_TWITTER_CARD, NODE_ENV,
    META_OG_IMAGE, META_KEYWORDS, ASSETSRC,
    META_OG_DESCRIPTION, META_DESCRIPTION
  } = config;

  fastify.setNotFoundHandler(function (request, reply) {
    if (ROUTE_PREFIX &&
      request.url.indexOf(ROUTE_PREFIX) === 0) {
      return reply.notFound();
    }

    const styleNonce = opts.nonce ? `nonce="${reply.cspNonce.style}"` : '';
    const scriptNonce = opts.nonce ? `nonce="${reply.cspNonce.script}"` : '';
    let metas = '';
    let splash = '';
    let styles = '';
    let scripts = '';
    if (ASSETSRC) {
      scripts = `
       <script src="${ASSETSRC}/static/js/bundle.js"></script>
       <script src="${ASSETSRC}/static/js/vendors~main.chunk.js"></script>
       <script src="${ASSETSRC}/static/js/main.chunk.js"></script>`;

      if (NODE_ENV && NODE_ENV.startsWith('prod')) {
        ['STYLES1', 'STYLES2', 'SCRIPTS0', 'SCRIPTS1', 'SCRIPTS2']
          .forEach(key => {
            if (!config[key]) {
              throw new Error(`Missing ${key} in config`);
            }
          });

        styles = `
         <link ${styleNonce} href="${ASSETSRC}${config.STYLES1}.css" rel="stylesheet" />
         <link ${styleNonce} href="${ASSETSRC}${config.STYLES2}.css" rel="stylesheet" />`;
        scripts = `
         <script ${scriptNonce} src="${ASSETSRC}${config.SCRIPTS0}.js"></script>
         <script ${scriptNonce} src="${ASSETSRC}${config.SCRIPTS1}.js"></script>
         <script ${scriptNonce} src="${ASSETSRC}${config.SCRIPTS2}.js"></script>`;
      }
    }
    if (SPLASH_IMAGE) {
      splash = `
        <div id="temp" style="background: url(${SPLASH_IMAGE}) no-repeat center center fixed; -webkit-background-size: auto 100%; -moz-background-size: auto 100%; -o-background-size: auto 100%; background-size: auto 100%;"></div>
        <style type="text/css">html, body, #root, #temp { height: 100%; width: 100%; margin: 0; padding: 0; }</style>`;
    }

    META_KEYWORDS && (metas += `<meta name="keywords" content="${META_KEYWORDS}">`);
    META_DESCRIPTION && (metas += `<meta name="description" content="${META_DESCRIPTION}">`);
    META_TWITTER_CARD && (metas += `<meta name="twitter:card" content="${META_TWITTER_CARD}">`);
    META_OG_DESCRIPTION && (metas += `<meta property="og:description" content="${META_OG_DESCRIPTION}">`);
    META_OG_TITLE && (metas += `<meta property="og:title" content="${META_OG_TITLE}">`);
    META_OG_IMAGE && (metas += `<meta property="og:image" content="${META_OG_IMAGE}">`);
    META_OG_URL && (metas += `<meta property="og:url" content="${META_OG_URL}">`);

    if (Array.isArray(opts.metas)) {
      opts.metas.forEach(meta => {
        metas += meta;
      });
    }

    reply
      .header('Surrogate-Control', 'no-store')
      .header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
      .header('Permissions-Policy', 'interest-cohort=()')
      .header('X-XSS-Protection', '1; mode=block')
      .header('Pragma', 'no-cache')
      .header('Expires', '0')
      .type('text/html')
      .send(`
 <!DOCTYPE html>
 <html>
   <head>
     <meta charset="utf-8">
     <meta http-equiv="X-UA-Compatible" content="IE=edge">
     <meta http-equiv="content-type" content="text/html; charset=UTF-8">
     <meta name="viewport" content="width=device-width, initial-scale=1.0">
     ${metas}
     <title>${config.PAGE_TITLE}</title>
     <link rel="icon" href="${ASSETSRC || ''}/favicon.ico">
     ${styles}
   </head>
   <body>
     <noscript>You need to enable JavaScript to run this app.</noscript>
     <div id="root">${splash}</div>
     ${scripts}
   </body>
 </html>`);
  });
}

export default fp(indexPage, {
  name: 'indexPage',
  dependencies: ['corscap']
});
