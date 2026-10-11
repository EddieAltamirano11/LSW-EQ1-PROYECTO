import { Router } from 'express';
import * as UnderlyingController from '../controllers/underlying.controller.js';

const router = Router();

router.get('/', UnderlyingController.getAllUnderlyings);
router.get('/symbol/:symbol', UnderlyingController.getUnderlyingBySymbol);
router.get('/:id', UnderlyingController.getUnderlyingById);
router.post('/', UnderlyingController.createUnderlying);
router.post('/batch', UnderlyingController.createUnderlyingsBatch);
router.put('/:id', UnderlyingController.updateUnderlying);
router.delete('/:id', UnderlyingController.deleteUnderlying);

export default router;

