import { Router } from 'express';
import * as QuantController from '../controllers/quant.controller.js';

const router = Router();

// Valuación analítica Black-Scholes y cálculo de las 5 Griegas
router.post('/black-scholes', QuantController.valuateBlackScholes);

// Estimación de volatilidad implícita vía método numérico Newton-Raphson
router.post('/implied-volatility', QuantController.computeImpliedVolatility);

export default router;

