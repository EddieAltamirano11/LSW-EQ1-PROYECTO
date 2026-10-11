import mongoose from 'mongoose';
import config from './config.js';

let isConnected = false;

export const connectMongoDB = async () => {
  if (isConnected) return;
  try {
    const conn = await mongoose.connect(config.MONGODB_URI, {
      dbName: config.MONGODB_DB_NAME,
      serverSelectionTimeoutMS: 8000,
    });
    isConnected = true;
    console.log(`[MongoDB Atlas] Conectado exitosamente a la BD: ${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error(`[MongoDB Atlas] Error al conectar: ${error.message}`);
    throw error;
  }
};

export const getMongoStatus = () => {
  return mongoose.connection.readyState === 1 ? 'CONNECTED' : 'DISCONNECTED';
};
