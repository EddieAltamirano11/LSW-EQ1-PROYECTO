// Debe evaluarse antes que app.js para que los modelos se compilen sin buffering.
import './config/mongoose.setup.js';
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
    console.warn(`[Aviso] MongoDB no pudo conectarse: ${err.message}`);
    console.warn('[Aviso] Las rutas que usen MongoDB responderán 500. Use x-database-selection: supabase para operar con PostgreSQL.');
  }

  // 2. Verificación de Supabase Cloud
  try {
    await testSupabaseConnection();
  } catch (err) {
    console.warn(`[Aviso] Supabase no pudo verificarse de inmediato: ${err.message}`);
  }

  // 3. Inicio del servidor HTTP Express
  // Con HOST=localhost se omite el host para escuchar en dual-stack (IPv4 + IPv6),
  // de modo que localhost, 127.0.0.1 y la IP de LAN funcionen por igual.
  const port = app.get('port');
  const useExplicitHost = config.HOST && config.HOST !== 'localhost';

  const onListening = () => {
    const baseUrl = `http://${config.HOST}:${port}${config.API_URL}`;
    console.log(`\nServidor Express escuchando en: ${baseUrl}`);
    console.log(`Documentación interactiva OpenSpec: ${baseUrl}/docs`);
    console.log(`Especificación cruda OpenSpec JSON: ${baseUrl}/spec.json`);
    console.log(`Estado MongoDB Atlas: ${getMongoStatus()}`);
    console.log('Persistencia Dual: Habilitada (MongoDB Atlas & Supabase PostgreSQL)');
    console.log('===============================================================\n');
  };

  const server = useExplicitHost
    ? app.listen(port, config.HOST, onListening)
    : app.listen(port, onListening);

  return server;
};

startServer();
