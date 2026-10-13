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
import { authMiddleware } from './middlewares/auth.middleware.js';
import { databaseContextMiddleware } from './middlewares/databaseContext.middleware.js';
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

// Inyección de contexto de persistencia y autenticación
app.use(authMiddleware);
app.use(databaseContextMiddleware);
// Carga y publicación dinámica del contrato OpenSpec
const specPath = path.join(__dirname, '../spec/openspec.yaml');

// Endpoint 2: Especificación OpenAPI / OpenSpec en JSON crudo
app.get(`${config.API_URL}/spec.json`, (req, res) => {
  try {
    const dynamicSpec = yaml.load(specPath);
    res.status(200).json(dynamicSpec);
  } catch (err) {
    res.status(500).json({ error: 'Error cargando la especificación OpenSpec', details: err.message });
  }
});

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

// Enrutador modular de la API
routerAPI(app);

// Middleware centralizado de errores
app.use(errorHandler);

export default app;
