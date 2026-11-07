import { Router } from 'express';
import authRoutes from '../../v1/routes/auth.routes.js';
import underlyingRoutes from '../../v1/routes/underlying.routes.js';
import hedgingRoutes from '../../v1/routes/hedging.routes.js';
import strategyRoutes from '../../v1/routes/strategy.routes.js';
import analyticsRoutes from '../../v1/routes/analytics.routes.js';
import quantRoutes from '../../v1/routes/quant.routes.js';
import brokerRoutes from '../../v1/routes/broker.routes.js';
import marketRoutes from '../../v1/routes/market.routes.js';
import docsRoutes from '../../v1/routes/docs.routes.js';
import scannerRoutes from './scanner.routes.js';

const routerAPIv2 = (app) => {
  const router = Router();

  // Montar en el prefijo oficial de versión 2
  app.use('/api/v2', router);

  // Submódulos heredados con soporte v2 nativo
  router.use('/auth', authRoutes);
  router.use('/underlyings', underlyingRoutes);
  router.use('/hedging', hedgingRoutes);
  router.use('/hedging-strategies', hedgingRoutes);
  router.use('/strategies', strategyRoutes);
  router.use('/analytics', analyticsRoutes);
  router.use('/quant', quantRoutes);
  router.use('/broker', brokerRoutes);
  router.use('/market', marketRoutes);
  router.use('/docs', docsRoutes);

  // Nuevas capacidades exclusivas de versión 2: Scanner y TradingView
  router.use('/market/scanner', scannerRoutes);
  router.use('/scanner', scannerRoutes);

  // Endpoint de Salud y Telemetría v2
  router.get('/health', (req, res) => {
    res.status(200).json({
      status: 'UP',
      version: 'v2.0.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      capabilities: [
        'QUANT_BLACK_SCHOLES_F0',
        'HEDGING_COLLAR_F2',
        'MULTI_BROKER_IBKR_ALPACA_WEBULL',
        'SCANNER_TOP_COLLARS_PROBABILITY',
        'TRADINGVIEW_INTEGRATION',
      ],
    });
  });

  // Descriptor del contrato y servicios v2
  router.get('/', (req, res) => {
    res.status(200).json({
      project: 'Infraestructura RESTful API para Coberturas Cuantitativas de Opciones — Versión 2',
      version: 'v2.0.0',
      course: 'Laboratorio de Servicios Web — IT Tepic',
      team: 'Equipo 1 - Los Eddies',
      author: 'Luis Duran <lucaduranoc@ittepic.edu.mx>',
      status: 'ONLINE',
      endpoints: {
        scannerTopCollars: '/api/v2/market/scanner/top-collars',
        companyCriteria: '/api/v2/market/scanner/company-criteria',
        tradingViewConfig: '/api/v2/market/scanner/tradingview/:symbol',
        blackScholes: '/api/v2/quant/black-scholes',
        autoCollar: '/api/v2/hedging/auto-collar',
        health: '/api/v2/health',
      },
    });
  });

  return router;
};

export default routerAPIv2;
