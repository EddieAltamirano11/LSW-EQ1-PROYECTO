import { createHmac, randomUUID } from 'node:crypto';
import boom from '@hapi/boom';
import config from '../../../config/config.js';
import { getAlpacaHeaders, isAlpacaConfigured } from '../../../config/broker.config.js';
import { DAY, MINUTE, SourceError, assertObservedFeed, iso, number, observation, pages, request, time, uniqueBy, within } from './observaciones.js';

// Cadena de opciones real compartida por el escáner (Core 004) y las coberturas (Auto-Collar, Protective Put, options-chain):
// contratos listados de Alpaca con cotizaciones firmadas de Webull OpenAPI. No genera strikes ni primas.

export const FUENTE_ALPACA = 'Alpaca Market Data IEX';
export const FUENTE_WEBULL = 'Webull OpenAPI';
export const formatoFechaEste = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
const formatoDesfaseEste = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', timeZoneName: 'shortOffset' });

export function convertirHoraSesion(fecha, hora) {
  const desfase = formatoDesfaseEste.formatToParts(new Date(`${fecha}T16:00:00Z`)).find(parte => parte.type === 'timeZoneName').value;
  const horasDesfase = Number(desfase.slice(3));
  return Date.parse(`${fecha}T${hora}:00Z`) - horasDesfase * 60 * MINUTE;
}

function construirUrl(origen, ruta, parametros) {
  const destino = new URL(ruta, origen);
  for (const [clave, valor] of Object.entries(parametros)) {
    if (valor != null) destino.searchParams.set(clave, String(valor));
  }
  return destino;
}

export function consultarAlpaca(fuente, ruta, parametros, senalCancelacion, origen = 'https://data.alpaca.markets') {
  if (!isAlpacaConfigured()) throw new SourceError(fuente, 'Faltan credenciales de Alpaca Market Data.');
  return request(fuente, construirUrl(origen, ruta, parametros), { headers: getAlpacaHeaders(), signal: senalCancelacion });
}

export function consultarWebull(ruta, parametros, senalCancelacion) {
  if (!config.WEBULL_APP_KEY || !config.WEBULL_APP_SECRET) {
    throw new SourceError(FUENTE_WEBULL, 'Faltan credenciales de Webull OpenAPI.');
  }
  const dominio = process.env.WEBULL_ENDPOINT || 'api.sandbox.webull.com';
  if (!['api.sandbox.webull.com', 'api.webull.com'].includes(dominio)) {
    throw new SourceError(FUENTE_WEBULL, 'El dominio configurado para datos de opciones no es un servidor admitido de Webull.');
  }
  const encabezados = {
    'x-app-key': config.WEBULL_APP_KEY,
    'x-timestamp': new Date().toISOString().slice(0, 19) + 'Z',
    'x-signature-algorithm': 'HMAC-SHA1',
    'x-signature-version': '1.0',
    'x-signature-nonce': randomUUID().replaceAll('-', ''),
  };
  const camposFirma = { ...parametros, ...encabezados, host: dominio };
  const valoresFirma = Object.keys(camposFirma).sort().map(clave => `${clave}=${camposFirma[clave]}`).join('&');
  encabezados['x-signature'] = createHmac('sha1', `${config.WEBULL_APP_SECRET}&`)
    .update(encodeURIComponent(`${ruta}&${valoresFirma}`)).digest('base64');
  encabezados['x-version'] = 'v3';
  if (process.env.WEBULL_ACCESS_TOKEN) encabezados['x-access-token'] = process.env.WEBULL_ACCESS_TOKEN;
  return request(FUENTE_WEBULL, construirUrl(`https://${dominio}`, ruta, parametros), { headers: encabezados, signal: senalCancelacion });
}

export async function obtenerSesionBursatil(fechaCorte, senalCancelacion) {
  const corteMercado = fechaCorte - 15 * MINUTE;
  // El calendario se pide también hacia adelante para fechar en sesiones reales las ventanas proyectadas del Core 001.
  const dias = await consultarAlpaca('Calendario Alpaca', '/v2/calendar', {
    start: formatoFechaEste.format(fechaCorte - 10 * DAY), end: formatoFechaEste.format(fechaCorte + 130 * DAY),
  }, senalCancelacion, 'https://paper-api.alpaca.markets');
  if (!Array.isArray(dias)) throw new SourceError(FUENTE_ALPACA, 'Calendario bursátil incompleto.');
  const sesiones = dias.map(dia => ({
    date: dia.date, open: convertirHoraSesion(dia.date, dia.open), close: convertirHoraSesion(dia.date, dia.close),
  })).filter(dia => Number.isFinite(dia.open) && Number.isFinite(dia.close)).sort((a, b) => a.open - b.open);
  const sesion = sesiones.findLast(dia => dia.open <= corteMercado);
  const ultimaSesionCerrada = sesiones.findLast(dia => dia.close <= corteMercado);
  if (!sesion || !ultimaSesionCerrada) throw new SourceError(FUENTE_ALPACA, 'No se encontró una sesión bursátil verificable.');
  const corteCotizacion = Math.min(corteMercado, sesion.close);
  return { asOf: fechaCorte, cutoff: corteMercado, session: sesion, lastClosed: ultimaSesionCerrada,
    quoteCut: corteCotizacion, quoteStart: Math.max(sesion.open, corteCotizacion - 60 * MINUTE),
    upcoming: sesiones.filter(dia => dia.date > ultimaSesionCerrada.date).map(dia => dia.date) };
}

export async function consultarVelas(simbolo, temporalidad, inicio, fin, senalCancelacion) {
  const flujoDatos = 'iex';
  assertObservedFeed(FUENTE_ALPACA, flujoDatos);
  const ruta = `/v2/stocks/${encodeURIComponent(simbolo)}/bars`;
  const registros = await pages(FUENTE_ALPACA, async cursorPagina => {
    const respuesta = await consultarAlpaca(FUENTE_ALPACA, ruta, {
      start: iso(inicio), end: iso(fin), timeframe: temporalidad, feed: flujoDatos, adjustment: 'split', limit: 1500, page_token: cursorPagina,
    }, senalCancelacion);
    return { items: respuesta.bars ?? [], cursor: respuesta.next_page_token };
  });
  return uniqueBy(registros, registro => registro.t).filter(registro => within(registro.t, inicio, fin)).map(registro => ({
    at: time(registro.t), open: number(registro.o), high: number(registro.h), low: number(registro.l), close: number(registro.c), volume: number(registro.v),
  })).filter(vela => vela.open > 0 && vela.close > 0 && vela.low > 0 && vela.high >= Math.max(vela.open, vela.close, vela.low)
    && vela.low <= Math.min(vela.open, vela.close) && vela.volume >= 0 && vela.volume !== null).sort((a, b) => a.at - b.at);
}

export async function obtenerPrecioSubyacente(simbolo, sesionMercado, senalCancelacion) {
  const velas = await consultarVelas(simbolo, '1Min', sesionMercado.quoteStart, sesionMercado.quoteCut, senalCancelacion);
  const ultimaVela = velas.findLast(vela => vela.at + MINUTE <= sesionMercado.quoteCut);
  if (!ultimaVela) throw new SourceError(FUENTE_ALPACA, 'No hay precio observado del subyacente en la sesión de análisis.');
  return { price: ultimaVela.close, at: ultimaVela.at + MINUTE,
    evidence: observation(FUENTE_ALPACA, iso(ultimaVela.at + MINUTE), `${simbolo} · cierre de 1 minuto`) };
}

function normalizarContrato(contrato, simbolo) {
  const multiplicador = number(contrato.multiplier ?? contrato.size);
  const esEstandar = multiplicador === 100 && (!contrato.deliverables?.length || (contrato.deliverables.length === 1
    && (contrato.deliverables[0].asset_type ?? contrato.deliverables[0].type) === 'equity' && contrato.deliverables[0].symbol === simbolo
    && Number(contrato.deliverables[0].amount) === multiplicador));
  return { symbol: contrato.symbol, underlying: contrato.underlying_symbol, type: contrato.type, expiration: contrato.expiration_date,
    strike: number(contrato.strike_price), multiplier: multiplicador, standard: esEstandar, interestDate: contrato.open_interest_date };
}

export async function obtenerCadenaOpciones(simbolo, cotizacionSubyacente, horizonteDias, sesionMercado, senalCancelacion) {
  const fuente = 'Alpaca metadatos de contratos';
  const vencimientoObjetivo = Date.parse(formatoFechaEste.format(sesionMercado.asOf)) + horizonteDias * DAY;
  const contratos = await pages(fuente, async cursorPagina => {
    const respuesta = await consultarAlpaca(fuente, '/v2/options/contracts', {
      underlying_symbols: simbolo, expiration_date_gte: iso(vencimientoObjetivo - 10 * DAY).slice(0, 10),
      expiration_date_lte: iso(vencimientoObjetivo + 10 * DAY).slice(0, 10), strike_price_gte: (cotizacionSubyacente.price * 0.88).toFixed(2),
      strike_price_lte: (cotizacionSubyacente.price * 1.12).toFixed(2), status: 'active', show_deliverables: true,
      limit: 1000, page_token: cursorPagina,
    }, senalCancelacion, 'https://paper-api.alpaca.markets');
    return { items: respuesta.option_contracts, cursor: respuesta.next_page_token };
  });
  const contratosAptos = uniqueBy(contratos.filter(contrato => contrato.tradable), contrato => contrato.symbol)
    .map(contrato => normalizarContrato(contrato, simbolo))
    .filter(contrato => contrato.underlying === simbolo && contrato.standard && contrato.strike > 0 && contrato.symbol);
  const vencimientos = [...new Set(contratosAptos.map(contrato => contrato.expiration))]
    .sort((a, b) => Math.abs(time(a) - vencimientoObjetivo) - Math.abs(time(b) - vencimientoObjetivo) || a.localeCompare(b)).slice(0, 3);
  const contratosSeleccionados = vencimientos.flatMap(vencimiento => ['put', 'call'].flatMap(tipo => contratosAptos
    .filter(contrato => contrato.expiration === vencimiento && contrato.type === tipo
      && (tipo === 'put' ? contrato.strike < cotizacionSubyacente.price : contrato.strike > cotizacionSubyacente.price))
    .sort((a, b) => Math.abs(a.strike - cotizacionSubyacente.price * (tipo === 'put' ? 0.95 : 1.05))
      - Math.abs(b.strike - cotizacionSubyacente.price * (tipo === 'put' ? 0.95 : 1.05)) || a.symbol.localeCompare(b.symbol)).slice(0, 3)));
  const evidencia = [observation(fuente, iso(sesionMercado.asOf), `${simbolo} · contratos activos dentro del horizonte solicitado`)];
  if (!contratosSeleccionados.length) return { contracts: [], evidence: evidencia, target: vencimientoObjetivo };
  const contratosCotizados = await cotizarContratos(contratosSeleccionados, sesionMercado, senalCancelacion);
  if (!contratosCotizados.length) throw new SourceError(FUENTE_WEBULL, 'Las cotizaciones de opciones disponibles no corresponden a la ventana de mercado.');
  return { contracts: contratosCotizados, evidence: evidencia, target: vencimientoObjetivo };
}

// Cotiza contratos listados con snapshots firmados de Webull. Descarta cotizaciones fuera de la sesión o con más de 15 min de retraso.
// Webull rechaza el lote completo (417 INVALID_SYMBOL) si un símbolo no está en su catálogo, aunque Alpaca lo liste.
// Esos contratos no tienen cotización: se excluyen y se vuelve a pedir el resto del lote.
function simbolosInvalidosWebull(error) {
  if (!(error instanceof SourceError) || error.status !== 417 || !/INVALID_SYMBOL/.test(error.cuerpo ?? '')) return null;
  const lista = /\[([^\]]*)\]/.exec(error.cuerpo)?.[1];
  return lista ? lista.split(',').map(simbolo => simbolo.trim()).filter(Boolean) : null;
}

export async function cotizarContratos(contratos, sesionMercado, senalCancelacion) {
  let pendientes = contratos;
  let cotizaciones;
  for (let intento = 0; intento < 3 && pendientes.length; intento++) {
    try {
      cotizaciones = await consultarWebull('/market-data/options/snapshots/list', {
        symbols: pendientes.map(contrato => contrato.symbol).join(','), category: 'US_OPTION',
      }, senalCancelacion);
      break;
    } catch (error) {
      const invalidos = simbolosInvalidosWebull(error);
      if (!invalidos?.length) throw error;
      pendientes = pendientes.filter(contrato => !invalidos.includes(contrato.symbol));
    }
  }
  if (!pendientes.length) return [];
  if (cotizaciones === undefined) throw new SourceError(FUENTE_WEBULL, 'Webull no aceptó los símbolos de la cadena.');
  if (!Array.isArray(cotizaciones)) throw new SourceError(FUENTE_WEBULL, 'La cadena no contiene cotizaciones reconocibles.');
  const cotizacionesPorSimbolo = new Map(cotizaciones.map(cotizacion => [cotizacion.symbol, cotizacion]));
  return contratos.flatMap(contrato => {
    const cotizacion = cotizacionesPorSimbolo.get(contrato.symbol);
    if (!cotizacion || !within(number(cotizacion.quote_time), sesionMercado.quoteStart, sesionMercado.asOf)) return [];
    const { bid, ask, volume: volumen, open_interest: interesAbierto, gamma, delay_minutes: retrasoMinutos } = cotizacion;
    if (number(retrasoMinutos) !== null && number(retrasoMinutos) > 15) return [];
    return [{ ...contrato, bid: number(bid), ask: number(ask), volume: number(volumen), interest: number(interesAbierto),
      gamma: number(gamma), at: number(cotizacion.quote_time), delay: number(retrasoMinutos) ?? 0 }];
  });
}


// ---------------------------------------------------------------------------------------------
// Regla de selección del Core 004, compartida con el Auto-Collar y la recomendación de opciones.
// ---------------------------------------------------------------------------------------------
export const spreadRelativo = opcion => 2 * (opcion.ask - opcion.bid) / (opcion.ask + opcion.bid);

export function contratoLiquido(opcion) {
  return opcion.standard && opcion.multiplier === 100 && opcion.bid > 0 && opcion.ask >= opcion.bid
    && spreadRelativo(opcion) <= 0.35 && opcion.interest >= 10 && opcion.volume >= 1;
}

// Put y Call OTM líquidos del mismo vencimiento: cercanía al horizonte, luego al 95 % / 105 % del precio, luego menor spread.
// El costo base (precio + ask del Put − bid del Call) debe quedar entre ambos strikes. Devuelve null si no hay par.
export function elegirCollar(spot, cadena) {
  const cotizados = cadena.contracts.filter(contratoLiquido);
  const pares = cotizados.filter(opcion => opcion.type === 'put' && opcion.strike < spot.price).flatMap(put => cotizados
    .filter(call => call.type === 'call' && call.expiration === put.expiration && call.strike > spot.price
      && call.multiplier === put.multiplier && call.underlying === put.underlying)
    .map(call => ({ put, call, distance: Math.abs(put.strike / spot.price - 0.95) + Math.abs(call.strike / spot.price - 1.05) })));
  pares.sort((a, b) => Math.abs(time(a.put.expiration) - cadena.target) - Math.abs(time(b.put.expiration) - cadena.target)
    || a.distance - b.distance || spreadRelativo(a.put) + spreadRelativo(a.call) - spreadRelativo(b.put) - spreadRelativo(b.call)
    || a.put.symbol.localeCompare(b.put.symbol) || a.call.symbol.localeCompare(b.call.symbol));
  const par = pares.find(({ put, call }) => {
    const base = spot.price + put.ask - call.bid;
    return base >= put.strike && base <= call.strike;
  });
  return par ? { put: par.put, call: par.call } : null;
}

// ---------------------------------------------------------------------------------------------
// Cadena para coberturas y para GET /broker/options-chain
// ---------------------------------------------------------------------------------------------
const DIAS_HORIZONTE_PREDETERMINADO = 45;

export function horizonteHasta(vencimiento, ahora = Date.now()) {
  if (!vencimiento) return DIAS_HORIZONTE_PREDETERMINADO;
  const fecha = Date.parse(`${String(vencimiento).slice(0, 10)}T00:00:00Z`);
  const hoy = Date.parse(`${formatoFechaEste.format(ahora)}T00:00:00Z`);
  if (!Number.isFinite(fecha) || fecha <= hoy) throw boom.badRequest(`El vencimiento '${vencimiento}' debe ser una fecha futura con formato AAAA-MM-DD.`);
  return Math.round((fecha - hoy) / DAY);
}

// Sesión, precio del subyacente y cadena real. Sin contratos cotizados, o si una fuente falla, responde 503 con la causa.
export async function obtenerCadenaCobertura(simbolo, { horizonteDias = DIAS_HORIZONTE_PREDETERMINADO, ahora = Date.now(), signal } = {}) {
  const ticker = String(simbolo).toUpperCase();
  const senal = signal ?? AbortSignal.timeout(30_000);
  try {
    const sesion = await obtenerSesionBursatil(ahora, senal);
    const spot = await obtenerPrecioSubyacente(ticker, sesion, senal);
    const cadena = await obtenerCadenaOpciones(ticker, spot, horizonteDias, sesion, senal);
    if (!cadena.contracts.length) throw new SourceError(FUENTE_WEBULL, `No hay contratos cotizados de ${ticker} cerca del horizonte de ${horizonteDias} días.`);
    return { simbolo: ticker, sesion, spot, cadena };
  } catch (error) {
    if (error instanceof SourceError) throw boom.serverUnavailable(`Sin cadena de opciones real para ${ticker}: ${error.reason}`);
    throw error;
  }
}

export const FUENTE_CADENA = 'Contratos listados de Alpaca con cotizaciones de Webull OpenAPI';

// Forma pública de un contrato: lo que reporta el proveedor, con instante, retraso y fuente.
export function contratoPublico(opcion) {
  return {
    contractSymbol: opcion.symbol,
    type: opcion.type === 'put' ? 'PUT' : 'CALL',
    strike: opcion.strike,
    expirationDate: opcion.expiration,
    multiplier: opcion.multiplier,
    bid: opcion.bid,
    ask: opcion.ask,
    volume: opcion.volume,
    openInterest: opcion.interest,
    quoteTime: Number.isFinite(opcion.at) ? iso(opcion.at) : null,
    delayMinutes: opcion.delay,
    source: FUENTE_CADENA,
  };
}

// ---------------------------------------------------------------------------------------------
// Contratos sueltos para ejecutar coberturas (contrato del ranking, Put del Protective Put)
// ---------------------------------------------------------------------------------------------
function enSesionCobertura(error) {
  if (error instanceof SourceError) return boom.serverUnavailable(`Sin cotización observada vigente: ${error.reason}`);
  return error;
}

// Precio observado del subyacente en la sesión vigente (el mismo que usa la cadena).
export async function obtenerSpotObservado(simbolo, { ahora = Date.now(), signal } = {}) {
  const senal = signal ?? AbortSignal.timeout(30_000);
  try {
    const sesion = await obtenerSesionBursatil(ahora, senal);
    return { sesion, spot: await obtenerPrecioSubyacente(String(simbolo).toUpperCase(), sesion, senal) };
  } catch (error) {
    throw enSesionCobertura(error);
  }
}

// Un contrato por su símbolo OCC: debe estar listado en Alpaca y tener cotización vigente en Webull.
export async function contratoCotizadoPorSimbolo(simboloOcc, { ahora = Date.now(), signal } = {}) {
  const senal = signal ?? AbortSignal.timeout(30_000);
  try {
    const sesion = await obtenerSesionBursatil(ahora, senal);
    const listado = await consultarAlpaca('Alpaca metadatos de contratos', `/v2/options/contracts/${encodeURIComponent(simboloOcc)}`, {},
      senal, 'https://paper-api.alpaca.markets');
    const contrato = normalizarContrato(listado, listado?.underlying_symbol);
    if (!contrato.symbol || contrato.symbol !== simboloOcc) throw new SourceError(FUENTE_WEBULL, `${simboloOcc} no está listado.`);
    const [cotizado] = await cotizarContratos([contrato], sesion, senal);
    if (!cotizado) throw new SourceError(FUENTE_WEBULL, `${simboloOcc} no tiene una cotización vigente.`);
    return cotizado;
  } catch (error) {
    throw enSesionCobertura(error);
  }
}

// Contratos listados de un tipo y vencimiento, cotizados (para elegir el strike listado más cercano).
export async function contratosListadosCotizados(simbolo, { tipo, vencimiento, strikeMaximo, ahora = Date.now(), signal } = {}) {
  const senal = signal ?? AbortSignal.timeout(30_000);
  const ticker = String(simbolo).toUpperCase();
  try {
    const sesion = await obtenerSesionBursatil(ahora, senal);
    const fuente = 'Alpaca metadatos de contratos';
    const listados = await pages(fuente, async cursorPagina => {
      const respuesta = await consultarAlpaca(fuente, '/v2/options/contracts', {
        underlying_symbols: ticker, type: tipo, expiration_date: vencimiento, strike_price_lte: strikeMaximo,
        status: 'active', show_deliverables: true, limit: 1000, page_token: cursorPagina,
      }, senal, 'https://paper-api.alpaca.markets');
      return { items: respuesta.option_contracts, cursor: respuesta.next_page_token };
    });
    // Se cotizan los cinco strikes listados más altos que no superan el solicitado.
    const aptos = uniqueBy(listados.filter(c => c.tradable), c => c.symbol).map(c => normalizarContrato(c, ticker))
      .filter(c => c.underlying === ticker && c.standard && c.strike > 0).sort((a, b) => b.strike - a.strike).slice(0, 5);
    return await cotizarContratos(aptos, sesion, senal);
  } catch (error) {
    throw enSesionCobertura(error);
  }
}
