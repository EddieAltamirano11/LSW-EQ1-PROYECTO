// Qué collar mostrar en cada fila del ranking: el real del Core 004 cuando existe, o el del escáner marcado como teórico.
// Dashboard.jsx solo pinta lo que devuelven estas funciones.

const horaEste = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

// Prima teórica del escáner (Black-Scholes); `marketPremium` solo existe en backends anteriores a escaner-sin-precios-fijos.
const primaTeorica = pata => pata?.theoreticalPremium ?? pata?.marketPremium ?? null;

function costoNeto(debitoPorAccion) {
  if (debitoPorAccion === 0) return { tipo: 'Costo cero', monto: 0 };
  return { tipo: debitoPorAccion > 0 ? 'Débito' : 'Crédito', monto: Math.abs(debitoPorAccion) };
}

export function collarDeFila(candidato, filaCores) {
  const real = filaCores?.cores?.['004']?.result;
  if (real?.eligible) {
    // La hora que se muestra es la de la cotización más antigua de las dos patas.
    const instante = Math.min(real.put.at, real.call.at);
    const conHora = Number.isFinite(instante);
    return {
      origen: 'REAL',
      put: { strike: real.put.strike, vencimiento: real.put.expiration, prima: real.put.ask, lado: 'ask' },
      call: { strike: real.call.strike, vencimiento: real.call.expiration, prima: real.call.bid, lado: 'bid' },
      // En el Core 004, netPremiumPerShare positivo es débito (ask del Put − bid del Call).
      costoNeto: costoNeto(real.netPremiumPerShare),
      // Misma definición que el escáner: ganancia máxima sobre el valor de las acciones al spot.
      retornoMaxPct: (real.maxProfit / (real.underlyingPrice * real.shares)) * 100,
      cotizadoEn: conHora ? new Date(instante).toISOString() : null,
      horaCotizacion: conHora ? `${horaEste.format(instante)} ET` : null,
      probabilidadPct: null,
    };
  }
  const neto = candidato.financialMetrics?.netDebitCredit ?? 0;
  return {
    origen: 'TEORICO',
    put: { strike: candidato.putFloor?.strike, vencimiento: null, prima: primaTeorica(candidato.putFloor), lado: 'teórica' },
    call: { strike: candidato.callCeiling?.strike, vencimiento: null, prima: primaTeorica(candidato.callCeiling), lado: 'teórica' },
    // En el escáner, netDebitCredit positivo es crédito (prima del Call − prima del Put).
    costoNeto: costoNeto(-neto),
    retornoMaxPct: candidato.financialMetrics?.maxReturnPct ?? null,
    cotizadoEn: null,
    horaCotizacion: null,
    probabilidadPct: candidato.probabilities?.floorProtectionPct ?? null,
  };
}

const EXCLUSIONES = {
  VIABILITY_VETO: 'Veto de viabilidad',
  NO_COLLAR: 'Sin collar líquido',
  INSUFFICIENT_DATA: 'Datos insuficientes',
};

export function exclusionDeFila(excluida) {
  return { etiqueta: EXCLUSIONES[excluida.exclusionType] ?? 'Excluida', causa: excluida.reason, tipo: excluida.exclusionType };
}
