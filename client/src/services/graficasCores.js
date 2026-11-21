// Datos de las gráficas de la consulta por core: payoff del collar (004) y contribución a la confluencia (007).
// Salen del mismo resultado que la tabla, así que gráfica y tabla no pueden diferir.
import { CORES_INFO } from './coresInfo';

const dinero = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const redondear = valor => Math.round(valor * 100) / 100;

// Payoff al vencimiento de 100 acciones largas + Put comprado al ask + Call vendido al bid.
export function payoffCollar(collar) {
  if (!collar?.eligible) return null;
  const acciones = collar.shares;
  const base = collar.underlyingPrice + collar.put.ask - collar.call.bid;
  const strikePut = collar.put.strike;
  const strikeCall = collar.call.strike;
  const maxLoss = redondear((base - strikePut) * acciones);
  const maxProfit = redondear((strikeCall - base) * acciones);
  const margen = (strikeCall - strikePut) * 0.6;
  return {
    base,
    maxLoss,
    maxProfit,
    breakEven: redondear(base),
    puntos: [
      { precio: redondear(strikePut - margen), resultado: -maxLoss },
      { precio: strikePut, resultado: -maxLoss },
      { precio: strikeCall, resultado: maxProfit },
      { precio: redondear(strikeCall + margen), resultado: maxProfit },
    ],
  };
}

export function resumenPayoff(collar, payoff) {
  return `Collar con Put ${collar.put.strike} y Call ${collar.call.strike}, vencimiento ${collar.expiration}, `
    + `sobre ${collar.shares} acciones a ${dinero.format(collar.underlyingPrice)} USD. `
    + `Pérdida máxima ${dinero.format(payoff.maxLoss)} USD si el precio cierra en ${collar.put.strike} o menos; `
    + `punto de equilibrio en ${dinero.format(payoff.breakEven)} USD; `
    + `ganancia máxima ${dinero.format(payoff.maxProfit)} USD desde ${collar.call.strike}. Métricas al vencimiento antes de comisiones.`;
}

// Aporte de cada core al puntaje: peso efectivo × puntaje. La suma es el puntaje de la confluencia.
export function contribuciones(confluencia) {
  const alcistas = new Set(confluencia?.conflicts?.flatMap(conflicto => conflicto.bullish) ?? []);
  const bajistas = new Set(confluencia?.conflicts?.flatMap(conflicto => conflicto.bearish) ?? []);
  return (confluencia?.drivers ?? [])
    .map(driver => ({
      id: driver.id,
      nombre: CORES_INFO[driver.id]?.nombre ?? driver.id,
      peso: driver.weight,
      puntaje: driver.score,
      aporte: driver.weight * driver.score,
      // Los conflictos se reportan por grupo; 003 comparte grupo con 001.
      conflicto: alcistas.has(driver.group ?? driver.id) ? 'alcista' : bajistas.has(driver.group ?? driver.id) ? 'bajista' : null,
    }))
    .sort((a, b) => b.aporte - a.aporte);
}

export function resumenContribucion(confluencia, filas) {
  const partes = filas.map(fila => `${fila.nombre} ${dinero.format(fila.aporte)} (peso ${dinero.format(fila.peso * 100)} % × puntaje ${dinero.format(fila.puntaje)})`);
  const enConflicto = filas.filter(fila => fila.conflicto);
  const conflicto = enConflicto.length
    ? ` Hay conflicto de sesgos: ${enConflicto.map(fila => `${fila.nombre} ${fila.conflicto}`).join(', ')}.`
    : ' Sin conflictos de sesgo.';
  return `Puntaje de confluencia ${dinero.format(confluencia.score)}, suma de: ${partes.join('; ')}.${conflicto}`;
}
