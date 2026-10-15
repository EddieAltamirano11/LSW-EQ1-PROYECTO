import axios from 'axios';
import config from './config.js';
import { generateWebullHeaders } from '../utils/webullSignature.js';

export const isWebullConfigured = () => {
  return (
    Boolean(config.WEBULL_APP_KEY) &&
    config.WEBULL_APP_KEY.trim() !== '' &&
    config.WEBULL_APP_KEY !== 'tu_webull_app_key_aqui' &&
    Boolean(config.WEBULL_APP_SECRET) &&
    config.WEBULL_APP_SECRET.trim() !== '' &&
    config.WEBULL_APP_SECRET !== 'tu_webull_app_secret_aqui'
  );
};

export const getWebullSignedHeaders = (method = 'GET', path = '', queryParams = {}, body = null) => {
  try {
    const host = new URL(config.WEBULL_BASE_URL).host;
    return generateWebullHeaders(method, path, queryParams, body, host);
  } catch (e) {
    return generateWebullHeaders(method, path, queryParams, body, 'api.sandbox.webull.com');
  }
};

export const webullClient = axios.create({
  baseURL: config.WEBULL_BASE_URL,
  timeout: 7000,
});

export default {
  isWebullConfigured,
  getWebullSignedHeaders,
  webullClient,
};

