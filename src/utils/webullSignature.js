import crypto from 'crypto';
import config from '../config/config.js';

/**
 * Generador de cabeceras de autenticación y firma digital HMAC-SHA1 para Webull OpenAPI.
 * Cumple estrictamente con la especificación oficial de Webull OpenAPI v3:
 * https://developer.webull.com/apis/docs/authentication/signature
 *
 * @param {string} method - Método HTTP (GET, POST, DELETE, etc.)
 * @param {string} path - Ruta del endpoint (ej. /trade/v1/order/place)
 * @param {Object} queryParams - Parámetros de consulta opcionales
 * @param {Object|string} body - Cuerpo de la petición opcional
 * @param {string} host - Host de destino (ej. api.sandbox.webull.com)
 * @returns {Object} Headers HTTP listos para inyectar en la petición de Axios
 */
export const generateWebullHeaders = (method = 'GET', path = '', queryParams = {}, body = null, host = 'api.sandbox.webull.com') => {
  const appKey = config.WEBULL_APP_KEY;
  const appSecret = config.WEBULL_APP_SECRET;
  
  // Timestamp en formato ISO UTC: YYYY-MM-DDThh:mm:ssZ
  const timestamp = new Date().toISOString().slice(0, 19) + 'Z';
  const nonce = crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '') : Math.random().toString(36).substring(2, 15);
  const algorithm = 'HMAC-SHA1';
  const sigVersion = '1.0';

  // 1. Cabeceras que participan en el cálculo de la firma
  const signingHeaders = {
    'x-app-key': appKey,
    'x-signature-algorithm': algorithm,
    'x-signature-version': sigVersion,
    'x-signature-nonce': nonce,
    'x-timestamp': timestamp,
    'host': host,
  };

  // 2. Unir queryParams y signingHeaders
  const mergedParams = { ...signingHeaders, ...(queryParams || {}) };

  // 3. Ordenar todas las claves en orden alfabético ascendente
  const sortedKeys = Object.keys(mergedParams).sort();
  const str1 = sortedKeys
    .map((k) => `${k}=${mergedParams[k]}`)
    .join('&');

  // 4. Si hay cuerpo (body), calcular MD5 en mayúsculas: toUpper(MD5(body))
  let str2 = '';
  if (body) {
    const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
    str2 = crypto.createHash('md5').update(bodyString).digest('hex').toUpperCase();
  }

  // 5. Concatenar: str3 = path + & + str1 (+ & + str2 si hay body)
  const str3 = str2 ? `${path}&${str1}&${str2}` : `${path}&${str1}`;

  // 6. Calcular HMAC-SHA1 usando appSecret como clave
  let signature = '';
  if (appSecret) {
    signature = crypto
      .createHmac('sha1', appSecret)
      .update(str3)
      .digest('base64');
  }

  return {
    'Content-Type': 'application/json',
    'x-app-key': appKey,
    'x-signature-algorithm': algorithm,
    'x-signature-version': sigVersion,
    'x-signature-nonce': nonce,
    'x-timestamp': timestamp,
    'x-version': 'v3',
    'x-signature': signature,
  };
};

export default {
  generateWebullHeaders,
};
