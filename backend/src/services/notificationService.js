const https = require('https');

/**
 * Envía una notificación push via Expo Push Notifications. Nunca lanza: un
 * problema de red o de la API de Expo se loguea y devuelve null, en vez de
 * propagarse — la notificación push siempre es un efecto secundario de algo
 * que ya se guardó en la base (una asignación, una alerta, etc.), así que
 * un fallo acá no debe hacer fallar esa respuesta HTTP como si la acción
 * principal no se hubiera hecho.
 *
 * @param {string|string[]} tokens - Expo push token(s)
 * @param {string} title
 * @param {string} body
 * @param {object} data - Datos adicionales (usados en mobile para navegar al tocar la notificación)
 * @param {string} sound - 'default' para sonido estándar
 */
async function sendPushNotification(tokens, title, body, data = {}, sound = 'default') {
  const tokenList = Array.isArray(tokens) ? tokens : [tokens];
  const validTokens = tokenList.filter((t) => t && t.startsWith('ExponentPushToken'));

  if (validTokens.length === 0) return null;

  const messages = validTokens.map((token) => ({
    to: token,
    sound,
    title,
    body,
    data,
    priority: 'high',
    channelId: 'security-alerts',
  }));

  let response;
  try {
    response = await postToExpo(messages);
  } catch (err) {
    console.error('[Push] Error enviando notificación:', err.message);
    return null;
  }

  // Limpieza de tokens inválidos en segundo plano — no bloquea la
  // respuesta de este envío ni puede hacerlo fallar.
  clearInvalidTokens(validTokens, response).catch((err) => {
    console.error('[Push] Error limpiando tokens inválidos:', err.message);
  });

  return response;
}

function postToExpo(messages) {
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
      let raw = '';
      res.on('data', (chunk) => (raw += chunk));
      res.on('end', () => {
        // Expo puede devolver algo no-JSON ante un error transitorio del
        // lado de ellos (ej. 502) — antes esto tiraba una excepción sin
        // capturar dentro del callback del socket de red.
        try {
          resolve(JSON.parse(raw));
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// Un token queda inválido cuando el dispositivo desinstaló la app o el
// token rotó — Expo lo marca con status:'error' y details.error:
// 'DeviceNotRegistered' en la misma posición del array que se mandó. Sin
// esto, se le seguiría intentando mandar push a un token muerto en cada
// evento futuro sin que nadie se entere. Se limpia en los 3 modelos que
// pueden tener push token: un token pertenece a un solo usuario, así que
// como mucho una de las 3 queries afecta alguna fila.
async function clearInvalidTokens(tokens, response) {
  const tickets = response?.data;
  if (!Array.isArray(tickets)) return;

  const { SecurityStaff, Client, Admin } = require('../models');
  await Promise.all(
    tickets.map((ticket, i) => {
      if (ticket?.status !== 'error' || ticket?.details?.error !== 'DeviceNotRegistered') return null;
      const token = tokens[i];
      return Promise.all([
        SecurityStaff.update({ expoPushToken: null }, { where: { expoPushToken: token } }),
        Client.update({ expoPushToken: null }, { where: { expoPushToken: token } }),
        Admin.update({ expoPushToken: null }, { where: { expoPushToken: token } }),
      ]);
    })
  );
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
