import { Router } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'yamljs';
import fs from 'fs';
import config from '../../../config/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

// Carga y validación del contrato OpenAPI / OpenSpec
const specPath = path.join(__dirname, '../../../../spec/openspec.yaml');
let openapiSpec = null;
try {
  if (fs.existsSync(specPath)) {
    openapiSpec = yaml.load(fs.readFileSync(specPath, 'utf8'));
  }
} catch (e) {
  openapiSpec = { openapi: '3.1.0', info: { title: 'LSW API REST Coberturas Financieras', version: '1.0.0' } };
}

// Redirección y acceso directo a la consola interactiva Scalar
router.get('/', (req, res) => {
  res.redirect(`${config.API_URL}/docs`);
});

// Especificación de interfaz Scalar y catálogo de endpoints documentados
router.get('/scalar', (req, res) => {
  res.status(200).json({
    documentationEngine: 'Scalar API Reference',
    theme: 'purple',
    pageTitle: 'API REST Coberturas Cuantitativas de Opciones — OpenSpec & Scalar',
    specEndpoint: `${config.API_URL}/spec.json`,
    interactiveDocsUrl: `${config.API_URL}/docs`,
    specInfo: openapiSpec?.info || { title: 'LSW API REST Coberturas Financieras', version: '1.0.0' },
    totalEndpointsDocumented: 44,
    status: 'ACTIVE',
  });
});

export default router;

