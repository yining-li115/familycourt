/**
 * SMS service — sends verification codes.
 * SMS_PROVIDER=mock  →  logs code to console (development)
 * SMS_PROVIDER=aliyun →  Alibaba Cloud SMS (production)
 */

async function sendVerificationCode(phone, code) {
  const provider = process.env.SMS_PROVIDER || 'mock';

  if (provider === 'mock') {
    console.log(`[SMS MOCK] Phone: ${phone}  Code: ${code}`);
    return;
  }

  if (provider === 'aliyun') {
    // Lazy-require to avoid install errors in dev
    const Core = require('@alicloud/pop-core');
    const client = new Core({
      accessKeyId: process.env.SMS_ACCESS_KEY,
      accessKeySecret: process.env.SMS_SECRET,
      endpoint: 'https://dysmsapi.aliyuncs.com',
      apiVersion: '2017-05-25',
    });

    await client.request('SendSms', {
      PhoneNumbers: phone,
      SignName: process.env.SMS_SIGN_NAME || '家庭法院',
      TemplateCode: process.env.SMS_TEMPLATE_CODE,
      TemplateParam: JSON.stringify({ code }),
    });
    return;
  }

  throw new Error(`Unknown SMS_PROVIDER: ${provider}`);
}

module.exports = { sendVerificationCode };
