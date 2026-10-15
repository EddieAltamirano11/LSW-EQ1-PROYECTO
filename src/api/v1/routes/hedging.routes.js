import { Router } from 'express';
import * as HedgingController from '../controllers/hedging.controller.js';

const router = Router();

// === ESTRATEGIAS PRINCIPALES Y OPTIMIZACIÓN AUTOMÁTICA ===
router.get('/', HedgingController.listStrategies);
router.get('/recommend-option/:symbol', HedgingController.recommendOption);
router.get('/recommend-option/:symbol/:type', HedgingController.recommendOption);
router.get('/recommend-collar/:symbol', HedgingController.recommendCollar);
router.post('/auto-collar', HedgingController.autoCalibrateCollar);
router.post('/auto-collar/:symbol', HedgingController.autoCalibrateCollar);
router.post('/protective-put', HedgingController.createProtectivePut);
router.post('/collar-spread', HedgingController.createCollarSpread);
router.post('/batch', HedgingController.createStrategiesBatch);
router.get('/:id', HedgingController.getStrategyById);
router.put('/:id/status', HedgingController.updateStrategyStatus);
router.delete('/:id', HedgingController.deleteStrategy);

// === SUBDOCUMENTO: UNDERLYING ===
router.get('/:id/underlying', HedgingController.getUnderlyingSub);
router.put('/:id/underlying', HedgingController.updateUnderlyingSub);

// === SUBDOCUMENTO: LEGS (ARREGLO DE OBJETOS) ===
router.get('/:id/legs', HedgingController.getLegsList);
router.get('/:id/legs/:legId', HedgingController.getLegById);
router.post('/:id/legs', HedgingController.addSingleLeg);
router.post('/:id/legs/batch', HedgingController.addLegsBatch);
router.put('/:id/legs/batch', HedgingController.updateLegsBatch);
router.put('/:id/legs/:legId', HedgingController.updateSingleLeg);
router.delete('/:id/legs/batch', HedgingController.deleteLegsBatch);
router.delete('/:id/legs/:legId', HedgingController.deleteSingleLeg);

// === SUBDOCUMENTO: METRICS & PAYOFF ===
router.get('/:id/financial-metrics', HedgingController.getStrategyMetrics);
router.put('/:id/financial-metrics/recalculate', HedgingController.recalculateMetrics);
router.get('/:id/payoff-matrix', HedgingController.getPayoffMatrix);

export default router;

