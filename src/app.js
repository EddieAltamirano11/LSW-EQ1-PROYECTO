import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import yaml from 'yamljs';
import path from 'path';
import { fileURLToPath } from 'url';
import { apiReference } from '@scalar/express-api-reference';

import config from './config/config.js';
import routerAPI from './api/v1/routes/index.js';
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

// Carga y publicación del contrato OpenSpec
const specPath = path.join(__dirname, '../spec/openspec.yaml');
const openapiSpec = yaml.load(specPath);

// Endpoint 2: Especificación OpenAPI / OpenSpec en JSON crudo
app.get(`${config.API_URL}/spec.json`, (req, res) => {
  res.status(200).json(openapiSpec);
});

// Visor interactivo moderno OpenSpec (Scalar API Reference)
app.use(
  `${config.API_URL}/docs`,
  apiReference({
    spec: {
      content: openapiSpec,
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
    activeDatabase: req.headers['x-database-selection'] || 'mongodb',
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
