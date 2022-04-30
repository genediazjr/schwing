import fp from 'fastify-plugin';
import assert from 'assert';

async function privilege (fastify, opts = {}) {
  assert(opts.privilegeCheck, 'privilegeCheck function is missing');
  const privileges = {};
  if (opts.privileges) {
    for (const code in opts.privileges) {
      privileges[code.toLowerCase()] = opts.privileges[code];
    }
  }

  fastify.addHook('onRoute', onRoute);
  fastify.decorate('privileges', privileges);

  // if a route has code but no description, dont add to list of privilege
  function onRoute (route) {
    if (route.privilege) {
      if (typeof route.privilege === 'object' && !Array.isArray(route.privilege)) {
        const { code, description } = route.privilege;
        assert(code, 'privilege code is required');
        assert(description, 'privilege description is required');
        assert(!fastify.privileges[code], `privilege code ${code} already exists`);
        fastify.privileges[code.toLowerCase()] = description;
      }
      if (!route.privilege.preValidation) {
        route.preValidation = [fastify.authenticate];
      }
      if (!route.privilege.preHandler) {
        const check = route.privilege.code || route.privilege;
        route.preHandler = async (request, reply) => {
          // return true if authorized
          if (!request.user || !request.user.id ||
            !await opts.privilegeCheck(check, request.user.id, request)) {
            return reply.unauthorized('Access denied');
          }
        };
      }
    }
  }
}

export default fp(privilege, {
  name: 'privilege',
  dependencies: ['security']
});
