import { Router } from 'express';
import * as BrokerController from '../controllers/broker.controller.js';

const router = Router();

// Cotización bid/ask de alta frecuencia en tiempo real
router.get('/quote/:symbol', BrokerController.getQuote);

// Cadena de opciones viva clasificada por vencimiento
router.get('/options-chain/:symbol', BrokerController.getOptionsChain);

export default router;

