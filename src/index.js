import app from './app.js';
import config from './config/config.js';
import { connectMongoDB, getMongoStatus } from './config/mongo.config.js';
import { testSupabaseConnection, getSupabaseStatus } from './config/supabase.config.js';

const startServer = async () => {
  console.log('===============================================================');
  console.log('   INICIANDO SERVIDOR RESTful API — COBERTURAS FINANCIERAS     ');
  console.log('   Laboratorio de Servicios Web — Equipo 1 (Los Eddies)       ');
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
    const port = app.get('port');
    const host = config.HOST;
    const serverUrl = `http://${host}:${port}`;
    const apiUrl = `${serverUrl}${config.API_URL}`;
    const docsUrl = `${apiUrl}/docs`;
    const specUrl = `${apiUrl}/spec.json`;
    const clientUrl = 'http://localhost:5174';

    console.log('\n===============================================================');
    console.log('   SERVIDORES ACTIVOS — LISTOS PARA CONEXIÓN');
    console.log('===============================================================');
    console.log(`   ➜  Fontend:   ${clientUrl}`);
    console.log(`   ➜  Servidor Backend (REST):     ${serverUrl}`);
    console.log(`   ➜  Endpoints API Base:          ${apiUrl}`);
    console.log(`   ➜  Documentación OpenSpec:      ${docsUrl}`);
    console.log(`   ➜  Especificación OpenSpec:     ${specUrl}`);
    console.log('---------------------------------------------------------------');
    console.log(`   •  Estado MongoDB:              ${getMongoStatus()}`);
    console.log(`   •  Estado Supabase:             ${getSupabaseStatus()}`);
    console.log('   •  Persistencia Dual:           MongoDB & Supabase Habilitadas');
    console.log('===============================================================\n');
  });

  return server;
};

startServer();
