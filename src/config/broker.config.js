import axios from 'axios';
import config from './config.js';

export const isAlpacaConfigured = () => {
  return (
    Boolean(config.ALPACA_API_KEY_ID) &&
    config.ALPACA_API_KEY_ID !== 'PK_PAPER_DEMO_KEY' &&
    Boolean(config.ALPACA_API_SECRET_KEY) &&
    config.ALPACA_API_SECRET_KEY !== 'SK_PAPER_DEMO_SECRET'
  );
};

export const getAlpacaHeaders = () => {
  return {
    'APCA-API-KEY-ID': config.ALPACA_API_KEY_ID,
    'APCA-API-SECRET-KEY': config.ALPACA_API_SECRET_KEY,
    'Content-Type': 'application/json',
  };
};

export const alpacaDataClient = axios.create({
  baseURL: config.ALPACA_DATA_URL,
  timeout: 5000,
});

