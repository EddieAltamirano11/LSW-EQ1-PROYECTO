import { Router } from 'express';
import * as AnalyticsController from '../controllers/analytics.controller.js';

const router = Router();

// Estimación de volatilidad implícita vía Newton-Raphson
router.post('/implied-volatility', AnalyticsController.computeImpliedVolatility);

// Generación de matriz de pagos y curva de expiración
router.get('/payoff-matrix/:id', AnalyticsController.getPayoffMatrix);

export default router;
