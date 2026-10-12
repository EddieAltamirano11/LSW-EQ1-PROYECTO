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

// Actualización de parámetros estructurales de la estrategia
router.put('/:id', StrategyController.updateStrategy);

// Transición de estado de ciclo de vida
router.patch('/:id/status', StrategyController.updateStrategyStatus);
router.put('/:id/status', StrategyController.updateStrategyStatus);

// Eliminación lógica de la estrategia
router.delete('/:id', StrategyController.deleteStrategy);

export default router;

