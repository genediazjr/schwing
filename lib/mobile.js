import fp from 'fastify-plugin';
import { SetSMSAttributesCommand, PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import { FixMobile } from './util.js';

async function mobile (fastify, opts = {}) {
  const { config, log } = fastify;
  const { NODE_ENV, SMS_SPENDING_LIMIT } = config;
  const client = new SNSClient({ region: config.MOBILE_REGION });

  if (SMS_SPENDING_LIMIT && NODE_ENV && NODE_ENV.startsWith('prod')) {
    const prefs = {
      attributes: {
        DefaultSMSType: 'Transactional',
        MonthlySpendLimit: SMS_SPENDING_LIMIT
      }
    };

    try {
      const data = await client.send(new SetSMSAttributesCommand(prefs));
      log.info(`sms setup success to ${data.$metadata.requestId}`);
    } catch (err) {
      log.error(`sms setup error to ${JSON.stringify(prefs)}`);
      log.error(err);
      throw err;
    }
  }
  if (opts.mobileTemplates) {
    fastify.decorate('mobile', mobileSend);
  }

  async function mobileSend (params) {
    let template = opts.mobileTemplates[params.template];
    for (const key in params.body) {
      template = template.replace(new RegExp(`{${key}}`, 'g'), params.body[key]);
    }

    if (config.MASK_MOBILE) {
      params.to = params.to.split('#')[0];
    }

    const payload = {
      PhoneNumber: FixMobile(params.to),
      Message: template
    };

    try {
      const data = await client.send(new PublishCommand(payload));
      log.info(`sms ${params.template} sent to ${params.to} ${data.MessageId}`);
    } catch (err) {
      log.error(`sms ${params.template} error to ${params.to}`);
      log.error(err);
      throw err;
    }
  }
}

export default fp(mobile, { name: 'mobile' });
