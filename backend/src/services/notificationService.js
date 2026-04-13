const https = require('https');

/**
 * Envía una notificación push via Expo Push Notifications
 * @param {string|string[]} tokens - Expo push token(s)
 * @param {string} title
 * @param {string} body
 * @param {object} data - Datos adicionales
 * @param {string} sound - 'default' para sonido estándar
 */
async function sendPushNotification(tokens, title, body, data = {}, sound = 'default') {
  const tokenList = Array.isArray(tokens) ? tokens : [tokens];
  const validTokens = tokenList.filter((t) => t && t.startsWith('ExponentPushToken'));

  if (validTokens.length === 0) return;

  const messages = validTokens.map((token) => ({
    to: token,
    sound,
    title,
    body,
    data,
    priority: 'high',
    channelId: 'security-alerts',
  }));

  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(messages);

    const options = {
      hostname: 'exp.host',
      port: 443,
      path: '/--/api/v2/push/send',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve(JSON.parse(data)));
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

/**
 * Alerta sonora máxima para despertar guardias
 */
async function sendWakeUpAlert(tokens, message) {
  return sendPushNotification(
    tokens,
    '🚨 ALERTA DE SEGURIDAD',
    message,
    { type: 'wake_up' },
    'default'
  );
}

module.exports = { sendPushNotification, sendWakeUpAlert };
