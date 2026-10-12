import { Router } from 'express';
import * as LegController from '../controllers/leg.controller.js';

const router = Router({ mergeParams: true });

// Consulta de piernas embebidas dentro de la estrategia
router.get('/', LegController.getLegsList);

// Inserción atómica de nueva pierna (Call/Put)
router.post('/', LegController.addSingleLeg);

// Inserción en bloque de múltiples piernas financieras
router.post('/batch', LegController.addLegsBatch);

// Reordenamiento de posiciones de piernas en arreglo
router.put('/reorder', LegController.reorderLegs);

// Obtención de pierna individual por ID embebido
router.get('/:legId', LegController.getLegById);

// Actualización de parámetros y strike de pierna individual
router.put('/:legId', LegController.updateSingleLeg);

// Ajuste de ponderación y ratio de contratos
router.patch('/:legId/ratio', LegController.updateLegRatio);

// Eliminación atómica de pierna en arreglo embebido
router.delete('/:legId', LegController.deleteSingleLeg);

export default router;
