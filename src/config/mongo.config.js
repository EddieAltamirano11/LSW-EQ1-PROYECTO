import dns from 'node:dns';
import mongoose from 'mongoose';
import config from './config.js';

let isConnected = false;

// Detecta fallas de resolución DNS (habituales con MongoDB Atlas cuando el
// resolver local no atiende consultas SRV/TXT de _mongodb._tcp).
const isDnsResolutionError = (error) => {
  const message = String(error?.message || '').toLowerCase();
  return (
    ['ECONNREFUSED', 'ENOTFOUND', 'ESERVFAIL', 'ETIMEOUT', 'EAI_AGAIN'].includes(error?.code) ||
    message.includes('querysrv') ||
    message.includes('querytxt') ||
    message.includes('getaddrinfo') ||
    message.includes('srv')
  );
};

const resolveDnsServers = () => {
  const configured = String(config.DNS_SERVERS || '')
    .split(',')
    .map((server) => server.trim())
    .filter(Boolean);

  return configured.length > 0 ? configured : ['1.1.1.1', '8.8.8.8'];
};

const connectWithOptions = async () => {
  return await mongoose.connect(config.MONGODB_URI, {
    dbName: config.MONGODB_DB_NAME,
    serverSelectionTimeoutMS: 8000,
  });
};

export const connectMongoDB = async () => {
  if (isConnected) return;

  try {
    const conn = await connectWithOptions();
    isConnected = true;
    console.log(`[MongoDB Atlas] Conectado exitosamente a la BD: ${conn.connection.name}`);
    return conn;
  } catch (error) {
    if (!isDnsResolutionError(error)) {
      console.error(`[MongoDB Atlas] Error al conectar: ${error.message}`);
      throw error;
    }

    // Reintento único con DNS públicos: corrige entornos donde el resolver
    // local rechaza las consultas SRV que exige una URI mongodb+srv://.
    const fallbackServers = resolveDnsServers();
    console.warn(
      `[MongoDB Atlas] Falla de DNS (${error.message}). Reintentando con ${fallbackServers.join(', ')}...`
    );

    try {
      dns.setServers(fallbackServers);
      const conn = await connectWithOptions();
      isConnected = true;
      console.log(
        `[MongoDB Atlas] Conectado exitosamente a la BD: ${conn.connection.name} (DNS: ${fallbackServers.join(', ')})`
      );
      return conn;
    } catch (retryError) {
      console.error(`[MongoDB Atlas] Error al conectar tras reintento DNS: ${retryError.message}`);
      throw retryError;
    }
  }
};

export const getMongoStatus = () => {
  const states = ['DISCONNECTED', 'CONNECTED', 'CONNECTING', 'DISCONNECTING'];
  return states[mongoose.connection.readyState] || 'UNKNOWN';
};
