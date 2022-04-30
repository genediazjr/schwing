import fp from 'fastify-plugin';
import Axios from 'axios';

async function reCaptcha (fastify) {
  const { config } = fastify;
  fastify.decorate('reCaptcha',
    config.NODE_ENV === 'test'
      ? Function.prototype
      : captchaCheck);

  async function captchaCheck (request, reply) {
    try {
      const captcha = request.headers['x-captcha'];
      if (!captcha) {
        if (!reply) {
          return false;
        }
        reply.preconditionRequired();
      }
      const res = await Axios.post(
        `https://www.google.com/recaptcha/api/siteverify?secret=${config.RECAPTCHA_KEY}&response=${captcha}`,
        {}, { headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' } }
      );
      if (!res || !res.data || !res.data.success) {
        if (!reply) {
          return false;
        }
        reply.preconditionRequired();
      } else {
        return true;
      }
    } catch (err) {
      fastify.log.info(`${request.ip} ${err}`);
      if (!reply) {
        return false;
      }
      reply.preconditionRequired();
    }
  }
}

export default fp(reCaptcha, { name: 'reCaptcha' });
