// Vista previa real de las coberturas de la terminal derecha y solicitudes de emisión sin reintentos.
// Auto-Collar: el collar del Core 004 del ranking o, si el activo no lo tiene, la vista previa del backend.
// Protective Put: la recomendación real del backend con su contractSymbol.

const redondear = valor => Number(Number(valor).toFixed(2));

function costoNeto(debitoPorAccion) {
  if (!Number.isFinite(debitoPorAccion)) return null;
  if (debitoPorAccion === 0) return { tipo: 'Costo cero', monto: 0 };
  return { tipo: debitoPorAccion > 0 ? 'Débito' : 'Crédito', monto: redondear(Math.abs(debitoPorAccion)) };
}

const instante = valor => (Number.isFinite(valor) ? new Date(valor).toISOString() : valor ?? null);

export function collarDelRanking(screenerData, simbolo) {
  const fila = [...(screenerData?.candidates ?? []), ...(screenerData?.excluded ?? [])]
    .find(item => item.symbol?.toUpperCase() === String(simbolo).toUpperCase());
  const real = fila?.cores?.['004']?.result;
  if (!real?.eligible) return null;
  return {
    fuente: 'RANKING',
    etiqueta: 'Collar',
    symbol: fila.symbol,
    put: { contractSymbol: real.put.symbol, strike: real.put.strike, expirationDate: real.put.expiration, ask: real.put.ask, bid: real.put.bid,
      quoteTime: instante(real.put.at), source: 'Core 004 · Webull OpenAPI' },
    call: { contractSymbol: real.call.symbol, strike: real.call.strike, expirationDate: real.call.expiration, ask: real.call.ask, bid: real.call.bid,
      quoteTime: instante(real.call.at), source: 'Core 004 · Webull OpenAPI' },
    costoNeto: costoNeto(real.netPremiumPerShare),
  };
}

export function vistaDesdePreviewBackend(respuesta) {
  const p = respuesta?.preview;
  if (!p?.put || !p?.call) return null;
  return {
    fuente: 'BACKEND',
    etiqueta: 'Collar',
    symbol: p.symbol,
    put: { ...p.put },
    call: { ...p.call },
    costoNeto: costoNeto(p.metrics?.netPremiumPerShare),
  };
}

export function payloadAutoCollar(vista, { broker }) {
  return {
    symbol: vista.symbol,
    sharesCount: 100,
    // Sin portfolioId: el backend usa el portafolio por defecto de la base seleccionada (no se inventa uno por símbolo).
    broker,
    executeOrders: true,
    autoPersist: true,
    putContractSymbol: vista.put.contractSymbol,
    callContractSymbol: vista.call.contractSymbol,
  };
}

export function payloadProtectivePut(put, { broker, sharesCount, buyUnderlying }) {
  return { symbol: put.symbol, contractSymbol: put.contractSymbol, sharesCount, broker, executeOrders: true, buyUnderlying };
}

// Aviso de éxito con lo que devolvió la API (cantidad de órdenes y strikes enviados), no con los datos del escáner.
export function avisoExito(tipo, data, broker, simbolo) {
  const ordenes = data?.orders ?? data?.data?.orders ?? [];
  const put = ordenes.find(o => o.legRole === 'HEDGE_FLOOR');
  const call = ordenes.find(o => o.legRole === 'FINANCE_CEILING' || o.legRole === 'COVERED_STOCK');
  const acciones = ordenes.find(o => o.legRole === 'UNDERLYING');
  const partes = [
    put ? `Put $${put.strike}` : null,
    call ? `Call $${call.strike}` : null,
    acciones && tipo === 'PROTECTIVE_PUT' ? `${acciones.quantity} acciones` : null,
  ].filter(Boolean);
  const nombre = tipo === 'COLLAR' ? 'COLLAR' : 'PROTECTIVE PUT';
  return `[${nombre}] ${broker} aceptó ${ordenes.length} órdenes para ${simbolo}: ${partes.join(' + ')}. El llenado se consulta en las órdenes del broker.`;
}

// Una sola solicitud. Si no hay respuesta del servidor, el resultado de la operación es desconocido: no se reintenta.
export async function enviarUnaVez(url, opciones) {
  try {
    const respuesta = await fetch(url, opciones);
    const data = await respuesta.json().catch(() => ({}));
    return { red: false, status: respuesta.status, ok: respuesta.ok, data };
  } catch (error) {
    return {
      red: true,
      mensaje: `Resultado desconocido: no hubo respuesta del servidor (${error.message}). Revisa las órdenes en el broker antes de reintentar; la solicitud no se reenvió.`,
    };
  }
}

async function leer(url, token, broker, opciones = {}) {
  const respuesta = await enviarUnaVez(url, {
    ...opciones,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'x-broker-selection': broker },
  });
  if (respuesta.red) throw new Error('No hubo respuesta del servidor para la vista previa.');
  if (!respuesta.ok) throw new Error(respuesta.data?.message || `La API respondió ${respuesta.status}.`);
  return respuesta.data;
}

export async function cargarVistaPreviaCollar({ apiBase, token, broker, symbol }) {
  const data = await leer(`${apiBase}/api/v2/hedging/auto-collar`, token, broker, {
    method: 'POST', body: JSON.stringify({ symbol, executeOrders: false, broker }),
  });
  const vista = vistaDesdePreviewBackend(data);
  if (!vista) throw new Error('El backend no devolvió una vista previa del collar.');
  return vista;
}

export async function cargarRecomendacionPut({ apiBase, token, broker, symbol }) {
  const data = await leer(`${apiBase}/api/v2/hedging/recommend-option/${encodeURIComponent(symbol)}/PUT?broker=${broker}`, token, broker);
  const put = data?.recommendedContract;
  if (!put?.contractSymbol) throw new Error('El backend no devolvió un Put recomendado.');
  return { ...put, symbol: data.symbol, spotPrice: data.spotPrice, spotTime: data.spotTime };
}
