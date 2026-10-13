import { Router } from 'express';
import * as BrokerController from '../controllers/broker.controller.js';

const router = Router();

// Consulta de cuenta, balance y poder de compra del broker
router.get('/account', BrokerController.getAccount);

// Consulta de cotizaciones y opciones
router.get('/quote/:symbol', BrokerController.getQuote);
router.get('/options-chain/:symbol', BrokerController.getOptionsChain);
router.get('/positions', BrokerController.getPositions);

// Operaciones de órdenes bursátiles
router.get('/orders', BrokerController.getOrders);
router.post('/orders', BrokerController.createOrder);
router.delete('/orders/:id', BrokerController.cancelOrder);

// Sincronización de precio spot del subyacente en BD con datos del Broker
router.post('/sync-underlying/:symbol', BrokerController.syncUnderlying);

export default router;
