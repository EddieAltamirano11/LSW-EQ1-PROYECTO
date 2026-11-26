import { DAY, MINUTE, SourceError, iso, mapConcurrent, number, observation, pages, request, time, within } from './observations.js';
import { DIAS_CONTEXTO_NOTICIAS, DIAS_PUNTAJE_NOTICIAS } from './newsEvents.js';
import {
  FUENTE_ALPACA, FUENTE_WEBULL, consultarAlpaca, consultarVelas, consultarWebull, convertirHoraSesion, formatoFechaEste,
  obtenerCadenaOpciones, obtenerPrecioSubyacente, obtenerSesionBursatil,
} from '../../../v1/services/cadenaOpciones.service.js';

// La sesión, el precio del subyacente y la cadena de opciones viven en el servicio compartido de v1.
export { FUENTE_ALPACA, obtenerCadenaOpciones, obtenerPrecioSubyacente, obtenerSesionBursatil };

export async function obtenerHistorialVelas(simbolo, sesionMercado, senalCancelacion) {
  // Dos años de velas diarias para niveles y tendencias del Core 001; las ventanas intradía no cambian.
  const ventanas = [['1Day', 730 * DAY], ['1Hour', 35 * DAY], ['15Min', 24 * DAY]];
  const series = await Promise.all(ventanas.map(async ([periodo, intervaloHistorico]) => {
    const velas = await consultarVelas(simbolo, periodo, sesionMercado.quoteCut - intervaloHistorico, sesionMercado.quoteCut, senalCancelacion);
    const duracionVela = (periodo === '1Hour' ? 60 : periodo === '15Min' ? 15 : 24 * 60) * MINUTE;
    const velasCerradas = periodo === '1Day' ? velas.filter(vela => formatoFechaEste.format(vela.at) <= sesionMercado.lastClosed.date)
      : velas.filter(vela => {
        const fecha = formatoFechaEste.format(vela.at);
        const apertura = convertirHoraSesion(fecha, periodo === '1Hour' ? '09:00' : '09:30');
        const cierre = fecha === sesionMercado.session.date ? sesionMercado.session.close : convertirHoraSesion(fecha, '16:00');
        return vela.at >= apertura && vela.at < cierre && Math.min(vela.at + duracionVela, cierre) <= sesionMercado.quoteCut;
      });
    const ultimaVela = velasCerradas.at(-1);
    const fechaUltimaVela = ultimaVela ? formatoFechaEste.format(ultimaVela.at) : '';
    const esSesionActual = fechaUltimaVela === sesionMercado.session.date;
    const esUltimaSesionCerrada = fechaUltimaVela === sesionMercado.lastClosed.date;
    const cierreUltimaVela = ultimaVela ? Math.min(ultimaVela.at + duracionVela, convertirHoraSesion(fechaUltimaVela, '16:00')) : 0;
    const serieVigente = periodo === '1Day' ? esUltimaSesionCerrada
      : (esSesionActual && within(cierreUltimaVela, sesionMercado.quoteCut - 3 * 60 * MINUTE, sesionMercado.quoteCut + 5 * MINUTE))
        || (esUltimaSesionCerrada && sesionMercado.quoteCut - sesionMercado.session.open < 2 * 60 * MINUTE);
    if (velasCerradas.length < 60 || !serieVigente) throw new SourceError(FUENTE_ALPACA, `Serie ${periodo} incompleta o fuera de vigencia para ${simbolo}.`);
    return [periodo, velasCerradas];
  }));
  return { series: Object.fromEntries(series), calendar: sesionMercado.upcoming ?? [],
    evidence: series.map(([periodo, velas]) => observation(FUENTE_ALPACA, iso(velas.at(-1).at), `${simbolo} · ${periodo} · ${velas.length} velas cerradas`)) };
}

export const FUENTE_CALENDARIO = `${FUENTE_WEBULL} · Financial Alerts`;

// Sin una fecha utilizable no se estima ninguna: el riesgo de eventos queda UNVERIFIED en el orquestador.
export async function obtenerFechaResultados(simbolo, fechaCorte, senalCancelacion) {
  let respuesta;
  try {
    respuesta = await consultarWebull('/market-data/fundamentals/financial-alerts/get', { symbol: simbolo, category: 'US_STOCK' }, senalCancelacion);
  } catch (error) {
    throw new SourceError(FUENTE_CALENDARIO, `El calendario de resultados no respondió: ${error.reason ?? error.message}`);
  }
  if (!(respuesta?.start_date && respuesta?.end_date && within(respuesta.start_date, fechaCorte - DAY, fechaCorte + 180 * DAY)
    && time(respuesta.end_date) >= time(respuesta.start_date))) {
    throw new SourceError(FUENTE_CALENDARIO, `Webull no entregó una fecha de resultados utilizable para ${simbolo}.`);
  }
  // Webull informa una ventana de fechas de resultados; se conserva tal cual (estimated indica que es una ventana).
  return {
    start: respuesta.start_date, end: respuesta.end_date, estimated: true,
    evidence: observation(FUENTE_CALENDARIO, iso(fechaCorte), `${simbolo} · ${respuesta.start_date} a ${respuesta.end_date}`),
  };
}

export async function obtenerNoticiasAccion(simbolo, fechaCorte, senalCancelacion) {
  const fuente = 'Alpaca News';
  const consultarVentana = async (inicio, fin) => {
    const articulos = await pages(fuente, async cursorPagina => {
      const respuesta = await consultarAlpaca(fuente, '/v1beta1/news', {
        symbols: simbolo, start: iso(inicio), end: iso(fin), limit: 50, page_token: cursorPagina,
      }, senalCancelacion);
      return { items: respuesta?.news, cursor: respuesta?.next_page_token };
    });
    return articulos.filter(articulo => within(articulo.created_at, inicio, fin)
      && (!articulo.updated_at || time(articulo.updated_at) <= fechaCorte) && articulo.symbols?.includes(simbolo) && articulo.headline);
  };
  const inicioContexto = fechaCorte - DIAS_CONTEXTO_NOTICIAS * DAY;
  const inicioPuntaje = fechaCorte - DIAS_PUNTAJE_NOTICIAS * DAY;
  const [recientes, contexto] = await Promise.allSettled([
    consultarVentana(inicioPuntaje, fechaCorte), consultarVentana(inicioContexto, inicioPuntaje - 1),
  ]);
  if (recientes.status === 'rejected') throw recientes.reason;
  return {
    articles: [...recientes.value, ...(contexto.value ?? [])],
    evidence: observation(fuente, iso(fechaCorte), `${simbolo} · noticias desde ${iso(contexto.value ? inicioContexto : inicioPuntaje)}`),
    ...(contexto.status === 'rejected' && { contextReason: contexto.reason.reason ?? 'No se pudo verificar el contexto de noticias.' }),
  };
}

export async function obtenerVelasEventos(simbolo, sesionMercado, senalCancelacion) {
  const velas = await consultarVelas(simbolo, '1Day', sesionMercado.quoteCut - 55 * DAY, sesionMercado.quoteCut, senalCancelacion);
  return velas.filter(vela => formatoFechaEste.format(vela.at) <= sesionMercado.lastClosed.date);
}

export async function obtenerFlujoOpciones(cadena, sesionMercado, senalCancelacion) {
  const contratosActivos = cadena.contracts.filter(contrato => contrato.volume > 0 && contrato.interest >= 0 && contrato.interest !== null)
    .sort((a, b) => b.volume - a.volume || a.symbol.localeCompare(b.symbol)).slice(0, 2);
  return mapConcurrent(contratosActivos, 2, async contrato => {
    const respuesta = await consultarWebull('/market-data/options/ticks/list', { symbol: contrato.symbol, category: 'US_OPTION', count: 120 }, senalCancelacion);
    if (respuesta.symbol !== contrato.symbol || !Array.isArray(respuesta.result) || number(respuesta.delay_minutes) > 15) {
      throw new SourceError(FUENTE_WEBULL, 'Operaciones de opciones con contrato o retraso incompatibles.');
    }
    const operaciones = respuesta.result.filter(operacion => within(number(operacion.time), sesionMercado.session.open, sesionMercado.asOf)
      && number(operacion.price) > 0 && number(operacion.volume) > 0).map(operacion => ({
      at: number(operacion.time), price: number(operacion.price), size: number(operacion.volume), side: ['B', 'S'].includes(operacion.side) ? operacion.side : null,
    }));
    return { contract: contrato, trades: operaciones,
      evidence: observation(`${FUENTE_WEBULL} · Option Ticks`, operaciones[0] ? iso(operaciones[0].at) : iso(sesionMercado.cutoff), contrato.symbol, number(respuesta.delay_minutes) ?? 0) };
  });
}
