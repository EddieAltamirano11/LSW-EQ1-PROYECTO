import { Router } from 'express';
import * as BrokerController from '../controllers/broker.controller.js';

const router = Router();

// Consulta de cuenta, balance y poder de compra del broker
router.get('/account', BrokerController.getAccount);

// Consulta de cotizaciones y opciones
router.get('/quote/:symbol', BrokerController.getQuote);
router.get('/options-chain/:symbol', BrokerController.getOptionsChain);
router.get('/positions', BrokerController.getPositions);

export default router;
