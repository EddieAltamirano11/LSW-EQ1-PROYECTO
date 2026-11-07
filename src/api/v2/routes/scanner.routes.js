import { Router } from 'express';
import * as ScannerController from '../controllers/scanner.controller.js';

const router = Router();

// Escaneo cuantitativo Top 5 / Top 10 con evaluación de probabilidades
router.get('/top-collars', ScannerController.getTopCollars);

// Protocolo y criterios oficiales de selección de empresas
router.get('/company-criteria', ScannerController.getCompanyCriteria);

// Metadatos y configuración del widget oficial de TradingView
router.get('/tradingview/:symbol', ScannerController.getTradingViewConfig);

export default router;
