import { Router } from 'express';
import * as StrategyController from '../controllers/strategy.controller.js';

const router = Router();

// Consulta y listado general de estrategias
router.get('/', StrategyController.getAllStrategies);

// Consulta de estrategia por identificador
router.get('/:id', StrategyController.getStrategyById);

// Registro de estrategia con subdocumento underlying
router.post('/', StrategyController.createStrategy);

// Creación de Collar Spread manual estructurado
router.post('/collar-spread', StrategyController.createCollarSpread);

export default router;
