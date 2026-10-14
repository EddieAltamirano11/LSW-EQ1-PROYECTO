import crypto from 'crypto';
import config from '../config/config.js';

/**
 * Generador de cabeceras de autenticación y firma digital HMAC-SHA256 para Webull Open Platform.
 * Cumple con la especificación de Webull OpenAPI v1 (x-signature, x-timestamp, x-nonce, x-app-key).
 *
 * @param {string} method - Método HTTP (GET, POST, DELETE, etc.)
 * @param {string} path - Ruta del endpoint (ej. /trade/v1/order/place)
 * @param {Object} queryParams - Parámetros de consulta opcionales
 * @param {Object|string} body - Cuerpo de la petición opcional
 * @returns {Object} Headers HTTP listos para inyectar en la petición de Axios
 */
export const generateWebullHeaders = (method = 'GET', path = '', queryParams = {}, body = null) => {
  const appKey = config.WEBULL_APP_KEY;
  const appSecret = config.WEBULL_APP_SECRET;
  const timestamp = Date.now().toString();
  const nonce = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);

  let canonicalQuery = '';
  if (queryParams && Object.keys(queryParams).length > 0) {
    const sortedKeys = Object.keys(queryParams).sort();
    canonicalQuery = sortedKeys
      .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(queryParams[k])}`)
      .join('&');
  }

  let bodyString = '';
  if (body) {
    bodyString = typeof body === 'string' ? body : JSON.stringify(body);
  }

  // Estructura canónica: METHOD\nPATH\nQUERY\nTIMESTAMP\nNONCE\nBODY
  const stringToSign = [
    method.toUpperCase(),
    path,
    canonicalQuery,
    timestamp,
    nonce,
    bodyString,
  ].join('\n');

  let signature = '';
  if (appSecret) {
    signature = crypto
      .createHmac('sha256', appSecret)
      .update(stringToSign)
      .digest('base64');
  }

  return {
    'Content-Type': 'application/json',
    'x-app-key': appKey,
    'x-timestamp': timestamp,
    'x-nonce': nonce,
    'x-signature-version': 'v1',
    'x-signature-algorithm': 'HMAC-SHA256',
    'x-signature': signature,
  };
};

export default {
  generateWebullHeaders,
};
