import mongoose from 'mongoose';
import dns from 'dns';
import config from './config.js';

let isConnected = false;

export const connectMongoDB = async () => {
  if (isConnected && mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  const cleanDbName = (config.MONGODB_DB_NAME || 'fintech_hedging_db').replace(/;/g, '').trim();
  const primaryUri = config.MONGODB_URI;
  const localFallbackUri = `mongodb://127.0.0.1:27017/${cleanDbName}`;
  const atlasUri = process.env.MONGODB_ATLAS_URI || '';

  // 1. Intentar conectar a la URI primaria configurada
  try {
    const isLocal = primaryUri.includes('127.0.0.1') || primaryUri.includes('localhost');
    if (!isLocal) {
      try {
        dns.setServers(['8.8.8.8', '1.1.1.1']);
      } catch (_) {}
    }

    const conn = await mongoose.connect(primaryUri, {
      dbName: cleanDbName,
      serverSelectionTimeoutMS: isLocal ? 2000 : 4000,
      connectTimeoutMS: isLocal ? 2000 : 4000,
    });
    isConnected = true;
    const isAtlas = primaryUri.includes('mongodb+srv') || primaryUri.includes('.mongodb.net');
    console.log(`[MongoDB] Conectado exitosamente (${isAtlas ? 'Atlas Cloud' : 'Local 127.0.0.1:27017'}): ${conn.connection.name}`);
    return conn;
  } catch (primaryErr) {
    // 2. Si falló y la URI no era localhost, intentar fallback automático a MongoDB local (127.0.0.1:27017)
    if (!primaryUri.includes('127.0.0.1') && !primaryUri.includes('localhost')) {
      try {
        console.log(`[MongoDB] Atlas no respondió (${primaryErr.message}). Conectando automáticamente al MongoDB local (127.0.0.1:27017)...`);
        const localConn = await mongoose.connect(localFallbackUri, {
          dbName: cleanDbName,
          serverSelectionTimeoutMS: 2000,
          connectTimeoutMS: 2000,
        });
        isConnected = true;
        console.log(`[MongoDB] Conectado exitosamente (Local 127.0.0.1:27017): ${localConn.connection.name}`);
        return localConn;
      } catch (localErr) {
        isConnected = false;
        console.error(`[MongoDB] Falló conexión primaria y local: ${localErr.message}`);
        throw primaryErr;
      }
    }

    // 3. Si falló la URI local y tenemos Atlas configurado, intentar Atlas como fallback
    if (atlasUri) {
      try {
        console.log(`[MongoDB] Local no respondió. Intentando conectar a Atlas...`);
        const atlasConn = await mongoose.connect(atlasUri, {
          dbName: cleanDbName,
          serverSelectionTimeoutMS: 4000,
        });
        isConnected = true;
        console.log(`[MongoDB] Conectado exitosamente (Atlas Cloud): ${atlasConn.connection.name}`);
        return atlasConn;
      } catch (_) {}
    }

    isConnected = false;
    throw primaryErr;
  }
};

export const getMongoStatus = () => {
  return mongoose.connection.readyState === 1 ? 'CONNECTED' : 'DISCONNECTED';
};
