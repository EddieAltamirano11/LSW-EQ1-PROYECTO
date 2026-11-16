/**
 * ARCHIVO OBSOLETO / DEPRECADO
 * 
 * En cumplimiento de la política de CERO SIMULACIÓN y exclusividad de Brokers Bursátiles Reales
 * (Alpaca, Webull, Interactive Brokers), el cálculo y escaneo local simulado ha sido eliminado.
 * Todas las evaluaciones provienen directamente del endpoint institucional /api/v2/market/scanner.
 */

export const BASKET = [];
export const computeLocalCandidates = () => ({
  success: false,
  error: 'El escáner local simulado ha sido deshabilitado. Utilice la conexión en vivo con el broker.',
  candidates: [],
});

export default {
  BASKET,
  computeLocalCandidates,
};
