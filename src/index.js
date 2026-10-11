import app from './app.js';
import config from './config/config.js';
import { connectMongoDB, getMongoStatus } from './config/mongo.config.js';
import { testSupabaseConnection } from './config/supabase.config.js';

const startServer = async () => {
  console.log('===============================================================');
  console.log('   INICIANDO SERVIDOR RESTful API — COBERTURAS FINANCIERAS     ');
  console.log('   Laboratorio de Servicios Web — Equipo 1 (Los Eddies)       ');
  console.log('   TecNM IT Tepic — Ingeniería en Sistemas Computacionales    ');
  console.log('===============================================================');

  // 1. Conexión asíncrona a MongoDB Atlas
  try {
    await connectMongoDB();
  } catch (err) {
    console.warn(`[Aviso] MongoDB no pudo conectarse de inmediato: ${err.message}`);
  }

  // 2. Verificación de Supabase Cloud
  try {
    await testSupabaseConnection();
  } catch (err) {
    console.warn(`[Aviso] Supabase no pudo verificarse de inmediato: ${err.message}`);
  }

  // 3. Inicio del servidor HTTP Express
  const server = app.listen(app.get('port'), config.HOST, () => {
    const baseUrl = `http://${config.HOST}:${app.get('port')}${config.API_URL}`;
    console.log(`\nServidor Express escuchando en: ${baseUrl}`);
    console.log(`Documentación interactiva OpenSpec: ${baseUrl}/docs`);
    console.log(`Especificación cruda OpenSpec JSON: ${baseUrl}/spec.json`);
    console.log(`Estado MongoDB Atlas: ${getMongoStatus()}`);
    console.log('Persistencia Dual: Habilitada (MongoDB Atlas & Supabase PostgreSQL)');
    console.log('===============================================================\n');
  });

  return server;
};

startServer();
