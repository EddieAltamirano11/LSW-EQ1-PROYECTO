import net from 'net';
import boom from '@hapi/boom';
import config from '../../../config/config.js';
import { getMongoStatus, connectMongoDB } from '../../../config/mongo.config.js';
import { testSupabaseConnection } from '../../../config/supabase.config.js';

/**
 * Prueba rápida y no bloqueante del socket TCP hacia TWS / Túnel
 */
export const checkIBKRTunnel = async (timeoutMs = 2500) => {
  const host = process.env.IBKR_TWS_HOST || config.IBKR_TWS_HOST || '127.0.0.1';
  const port = parseInt(process.env.IBKR_TWS_PORT || config.IBKR_TWS_PORT || 7497, 10);

  return new Promise((resolve) => {
    const socket = new net.Socket();
    let isSettled = false;

    socket.setTimeout(timeoutMs);

    socket.connect(port, host, () => {
      if (isSettled) return;
      isSettled = true;
      socket.destroy();
      resolve({
        connected: true,
        host,
        port,
        message: `Socket TCP hacia Trader Workstation (TWS) activo en ${host}:${port}.`,
      });
    });

    socket.on('error', (err) => {
      if (isSettled) return;
      isSettled = true;
      socket.destroy();
      resolve({
        connected: false,
        host,
        port,
        error: err.message,
        code: err.code,
      });
    });

    socket.on('timeout', () => {
      if (isSettled) return;
      isSettled = true;
      socket.destroy();
      resolve({
        connected: false,
        host,
        port,
        error: `Tiempo de espera agotado (${timeoutMs}ms) al intentar conectar con ${host}:${port}.`,
        code: 'ETIMEDOUT',
      });
    });
  });
};

/**
 * Verificación de salud y conectividad de MongoDB Atlas y Supabase Cloud
 */
export const checkDatabasesHealth = async () => {
  // 1. MongoDB Atlas
  let mongoStatus = getMongoStatus();
  if (mongoStatus !== 'CONNECTED') {
    try {
      await connectMongoDB();
      mongoStatus = getMongoStatus();
    } catch (_) {
      mongoStatus = 'DISCONNECTED';
    }
  }

  // 2. Supabase Cloud
  let supabaseStatus = 'DISCONNECTED';
  try {
    const supaRes = await testSupabaseConnection();
    supabaseStatus = supaRes === 'CONNECTED' ? 'CONNECTED' : 'DISCONNECTED';
  } catch (_) {
    supabaseStatus = 'DISCONNECTED';
  }

  return {
    mongo: mongoStatus,
    supabase: supabaseStatus,
  };
};

/**
 * Guardia Pre-Vuelo estricto de Integridad Transaccional:
 * 1. Verifica conectividad con MongoDB Atlas y Supabase Cloud.
 * 2. Si el broker es IBKR, verifica que el túnel TCP hacia TWS esté activo.
 * 3. En caso de falla, lanza un error HTTP 503 explicativo garantizando 0 escrituras en BD.
 */
export const assertBrokerAndDatabasesReadiness = async ({ dbTarget = 'mongodb', broker = 'IBKR' } = {}) => {
  // 1. Testear estado de ambas bases de datos
  const dbHealth = await checkDatabasesHealth();

  // Validar base de datos solicitada para persistencia
  const target = (dbTarget || 'mongodb').toLowerCase();
  if (target === 'mongodb' && dbHealth.mongo !== 'CONNECTED') {
    throw boom.serverUnavailable(
      `No se puede procesar la operación: La base de datos MongoDB Atlas no está disponible (${dbHealth.mongo}). No se ejecutó ninguna acción en el broker ni se persistieron cambios.`
    );
  }
  if (target === 'supabase' && dbHealth.supabase !== 'CONNECTED') {
    throw boom.serverUnavailable(
      `No se puede procesar la operación: La base de datos Supabase Cloud no está disponible (${dbHealth.supabase}). No se ejecutó ninguna acción en el broker ni se persistieron cambios.`
    );
  }

  // 2. Si el broker objetivo es Interactive Brokers, validar el túnel TCP
  const targetBroker = (broker || '').toUpperCase();
  if (targetBroker === 'IBKR') {
    const tunnel = await checkIBKRTunnel(2500);
    if (!tunnel.connected) {
      throw boom.serverUnavailable(
        `Operación rechazada para Interactive Brokers (IBKR): El túnel o socket TCP hacia Trader Workstation (TWS) en la computadora host (${tunnel.host}:${tunnel.port}) no está disponible o la PC está desconectada (${tunnel.error || tunnel.code}). ` +
        `Diagnóstico de infraestructura: La API REST y las bases de datos están 100% operativas (MongoDB Atlas: ${dbHealth.mongo}, Supabase Cloud: ${dbHealth.supabase}). ` +
        `Por política estricta de consistencia e integridad transaccional, NO se emitió ninguna orden bursátil ni se registró ningún cambio en la base de datos (${target.toUpperCase()}) hasta que el túnel esté activo y la acción pueda aplicarse físicamente en TWS.`
      );
    }
  }

  return {
    ready: true,
    dbHealth,
    broker: targetBroker,
  };
};

export default {
  checkIBKRTunnel,
  checkDatabasesHealth,
  assertBrokerAndDatabasesReadiness,
};
