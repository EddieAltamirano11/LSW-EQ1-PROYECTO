import { formatoFechaEste, FUENTE_ALPACA } from '../../../v1/services/cadenaOpciones.service.js';
import { time } from './observations.js';
import { round } from './technicalCore.js';

export function referenciaDeMercado({ symbol, exchange }) {
  if (['NVDA', 'AMD'].includes(symbol)) return 'SMH';
  return exchange === 'NASDAQ' ? 'QQQ' : 'SPY';
}

function cambio(actual, base) {
  return Number.isFinite(actual) && base > 0 ? round((actual / base - 1) * 100) : null;
}

function volumenRelativo(velas, indice) {
  const actual = velas[indice]?.volume;
  if (indice < 20 || !Number.isFinite(actual)) return null;
  const volumenes = velas.slice(indice - 20, indice).map(vela => vela.volume).sort((a, b) => a - b);
  const mediana = (volumenes[9] + volumenes[10]) / 2;
  return volumenes.every(Number.isFinite) && mediana > 0 ? round(actual / mediana) : null;
}

export function anexarReaccionMercado(eventos, mercado, velas = [], referencia, velasReferencia = []) {
  const sesiones = mercado.sessions ?? [];
  const porFecha = new Map(velas.map((vela, i) => [formatoFechaEste.format(vela.at), i]));
  const referenciaPorFecha = new Map(velasReferencia.map(vela => [formatoFechaEste.format(vela.at), vela]));
  return eventos.map(evento => {
    const publicacion = time(evento.publishedAt);
    const indice = sesiones.findIndex(sesion => publicacion < sesion.close);
    const sesion = sesiones[indice];
    if (!sesion) return { ...evento, reaction: { status: 'UNAVAILABLE' } };
    if (sesion.close > (mercado.cutoff ?? mercado.quoteCut)) return { ...evento, reaction: { status: 'PENDING', session: sesion.date } };
    const anterior = sesiones[indice - 1]?.date;
    const indiceVela = porFecha.get(sesion.date);
    const vela = velas[indiceVela];
    const base = velas[porFecha.get(anterior)]?.close;
    if (!vela || !base) return { ...evento, reaction: { status: 'UNAVAILABLE', session: sesion.date } };

    const sessionChange = cambio(vela.close, base);
    const benchmarkChange = cambio(referenciaPorFecha.get(sesion.date)?.close, referenciaPorFecha.get(anterior)?.close);
    return {
      ...evento,
      reaction: {
        status: 'AVAILABLE', session: sesion.date, source: FUENTE_ALPACA,
        openingGap: publicacion <= sesion.open ? cambio(vela.open, base) : null, sessionChange,
        relativeVolume: volumenRelativo(velas, indiceVela),
        benchmark: benchmarkChange == null ? null : { symbol: referencia, sessionChange: benchmarkChange, excess: round(sessionChange - benchmarkChange) },
      },
    };
  });
}
