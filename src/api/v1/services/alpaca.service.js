import axios from 'axios';
import config from '../../../config/config.js';
import { isAlpacaConfigured, getAlpacaHeaders, alpacaDataClient } from '../../../config/broker.config.js';

// Servicio especializado para interacción directa con Alpaca Paper Trading API
export const getAlpacaAccount = async () => {
  if (!isAlpacaConfigured()) return null;
  const resp = await axios.get(`${config.ALPACA_BASE_URL}/v2/account`, {
    headers: getAlpacaHeaders(),
    timeout: 5000,
  });
  return resp.data;
};

export const getAlpacaPositions = async () => {
  if (!isAlpacaConfigured()) return [];
  const resp = await axios.get(`${config.ALPACA_BASE_URL}/v2/positions`, {
    headers: getAlpacaHeaders(),
    timeout: 5000,
  });
  return resp.data;
};

export const getAlpacaOrders = async (status = 'all') => {
  if (!isAlpacaConfigured()) return [];
  const resp = await axios.get(`${config.ALPACA_BASE_URL}/v2/orders?status=${status}&limit=25`, {
    headers: getAlpacaHeaders(),
    timeout: 5000,
  });
  return resp.data;
};

export const submitAlpacaOrder = async (orderPayload) => {
  if (!isAlpacaConfigured()) return null;
  const resp = await axios.post(`${config.ALPACA_BASE_URL}/v2/orders`, orderPayload, {
    headers: getAlpacaHeaders(),
    timeout: 7000,
  });
  return resp.data;
};

export const cancelAlpacaOrder = async (orderId) => {
  if (!isAlpacaConfigured()) return null;
  const resp = await axios.delete(`${config.ALPACA_BASE_URL}/v2/orders/${orderId}`, {
    headers: getAlpacaHeaders(),
    timeout: 5000,
  });
  return resp.data;
};

export const getAlpacaMarketSnapshot = async (symbol) => {
  if (!isAlpacaConfigured()) return null;
  const resp = await alpacaDataClient.get(`/stocks/${symbol.toUpperCase()}/snapshot?feed=iex`, {
    headers: getAlpacaHeaders(),
  });
  return resp.data;
};

