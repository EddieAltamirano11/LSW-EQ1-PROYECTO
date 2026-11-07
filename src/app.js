import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import yaml from 'yamljs';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { apiReference } from '@scalar/express-api-reference';

import config from './config/config.js';
import routerAPI from './api/v1/routes/index.js';
import routerAPIv2 from './api/v2/routes/index.js';
import loginRoutes from './web/login.routes.js';
import { authMiddleware } from './middlewares/auth.middleware.js';
import { databaseContextMiddleware } from './middlewares/databaseContext.middleware.js';
import { brokerContextMiddleware } from './middlewares/brokerContext.middleware.js';
import { errorHandler } from './middlewares/errorHandler.middleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('port', config.PORT);

// Middlewares estándar
app.use(cors({ origin: '*' }));
app.use(morgan('dev'));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: false }));

// Pantalla pública de acceso de demostración y cliente React SPA
app.use(loginRoutes);

const clientDistPath = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use('/dashboard', express.static(clientDistPath));
  app.get('/dashboard*', (req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Inyección de contexto de persistencia, autenticación y broker
app.use(authMiddleware);
app.use(databaseContextMiddleware);
app.use(brokerContextMiddleware);
// Carga y publicación dinámica del contrato OpenSpec
const specPath = path.join(__dirname, '../spec/openspec.yaml');

// Endpoint 2: Especificación OpenAPI / OpenSpec en JSON crudo (v1 y v2)
const handleSpecJson = (req, res) => {
  try {
    const dynamicSpec = yaml.load(specPath);
    res.status(200).json(dynamicSpec);
  } catch (err) {
    res.status(500).json({ error: 'Error cargando la especificación OpenSpec', details: err.message });
  }
};
app.get(`${config.API_URL}/spec.json`, handleSpecJson);
app.get('/api/v2/spec.json', handleSpecJson);

// Visor interactivo moderno OpenSpec (Scalar API Reference)
app.use(
  `${config.API_URL}/docs`,
  apiReference({
    spec: {
      url: `${config.API_URL}/spec.json`,
    },
    theme: 'purple',
    pageTitle: 'API REST Coberturas Financieras — OpenSpec',
  })
);
app.use(
  '/api/v2/docs',
  apiReference({
    spec: {
      url: '/api/v2/spec.json',
    },
    theme: 'purple',
    pageTitle: 'API REST Coberturas Financieras v2 — OpenSpec',
  })
);

// Endpoint Raíz Institucional / Health Check Global (Render & Browsers)
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'ONLINE',
    project: 'Infraestructura RESTful API para Coberturas Cuantitativas de Opciones',
    course: 'Laboratorio de Servicios Web — IT Tepic',
    team: 'Equipo 1 - Los Eddies',
    apiRoot: config.API_URL,
    documentation: `${config.API_URL}/docs`,
    openSpecJson: `${config.API_URL}/spec.json`,
    health: `${config.API_URL}/health`,
    preflight: `${config.API_URL}/preflight/readiness`,
    databases: {
      mongodb: 'CONNECTED',
      supabase: 'CONNECTED',
    },
    brokers: ['ALPACA', 'WEBULL', 'INTERACTIVE_BROKERS'],
  });
});

// Endpoint 1: Mensaje raíz institucional y descriptor de API
app.get(config.API_URL, (req, res) => {
  res.status(200).json({
    project: 'Infraestructura RESTful API para Coberturas Cuantitativas de Opciones (Protective Put & Collar)',
    course: 'Laboratorio de Servicios Web — IT Tepic',
    team: 'Equipo 1 - Los Eddies',
    author: 'Equipo 1 - Los Eddies (IT Tepic)',
    activeDatabase: req.dbTarget || 'mongodb',
    openSpecDocs: `http://${config.HOST}:${config.PORT}${config.API_URL}/docs`,
    openSpecJson: `http://${config.HOST}:${config.PORT}${config.API_URL}/spec.json`,
    status: 'ONLINE',
  });
});

// Enrutadores modulares de la API (v1 retrocompatible y v2 oficial)
routerAPI(app);
routerAPIv2(app);

// Middleware centralizado de errores
app.use(errorHandler);

export default app;
