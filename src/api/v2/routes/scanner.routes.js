import { Router } from 'express';
import * as ScannerController from '../controllers/scanner.controller.js';

// El escáner se puede inyectar (las pruebas usan un proveedor de cotizaciones sin red).
export function crearRutasEscaner(escanear) {
  const router = Router();

  // Escaneo cuantitativo teórico Top 5 / Top 10 con el precio observado de cada activo
  router.get('/top-collars', escanear ? ScannerController.crearGetTopCollars(escanear) : ScannerController.getTopCollars);

  // Protocolo y criterios oficiales de selección de empresas
  router.get('/company-criteria', ScannerController.getCompanyCriteria);

  // Metadatos y configuración del widget oficial de TradingView
  router.get('/tradingview/:symbol', ScannerController.getTradingViewConfig);

  return router;
}

export default crearRutasEscaner();
