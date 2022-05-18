import fp from 'fastify-plugin';
import Sensible from '@fastify/sensible';

async function httpCode (fastify) {
  fastify.register(Sensible, { errorHandler: false });

  fastify.decorateReply('ok', function (message) {
    this.send({
      statusCode: 200,
      message: message || 'success'
    });
  });

  fastify.decorateReply('created', function (message) {
    this.send({
      statusCode: 201,
      message: message || 'success'
    });
  });

  fastify.decorateReply('noContent', function (message) {
    this.send({
      statusCode: 204,
      message: message || 'success'
    });
  });
}

export default fp(httpCode, { name: 'httpCode' });
