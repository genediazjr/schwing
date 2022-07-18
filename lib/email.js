import fp from 'fastify-plugin';
import { SendEmailCommand, SESClient } from '@aws-sdk/client-ses';

async function email (fastify, opts = {}) {
  const { config, log } = fastify;
  const client = new SESClient({ region: config.EMAIL_REGION });
  if (config.EMAIL_FROM && opts.emailTemplates) {
    fastify.decorate('email', emailSend);
  }

  async function emailSend (params) {
    let template = opts.emailTemplates[params.template];
    for (const key in params.body) {
      template = template.replace(new RegExp(`{${key}}`, 'g'), params.body[key]);
    }
    if (config.EMAIL_LOGO) {
      template = template.replace(/{logo}/g, config.EMAIL_LOGO);
    }
    params.to = Array.isArray(params.to) ? params.to : [params.to];

    const body = { Data: template, Charset: 'UTF-8' };
    const subject = { Data: params.subject, Charset: 'UTF-8' };
    const payload = {
      Destination: { ToAddresses: params.to },
      Message: { Subject: subject, Body: { Html: body } },
      Source: config.EMAIL_FROM
    };

    try {
      const data = await client.send(new SendEmailCommand(payload));
      log.info(`email ${params.template} sent to ${params.to.join(' ')} ${data.MessageId}`);
    } catch (err) {
      log.error(`email ${params.template} error to ${params.to.join(' ')}`);
      log.error(err);
      throw err;
    }
  }
}

export default fp(email, { name: 'email' });
