import boom from '@hapi/boom';
import {
  parseScreenerInput as validarCriteriosEscaner,
  parseTechnicalSymbol as validarSimbolo,
  runStrategyScreener as ejecutarEscanerEstrategias,
} from '../strategyScreener.service.js';
import { createAiProvider as crearProveedorIA } from './aiProvider.js';

const CAMPOS_PERMITIDOS = ['scope', 'symbol', 'activeCores', 'dteHorizon', 'extraSymbols'];
const VEREDICTOS = ['CONSIDER', 'AVOID', 'WAIT'];

function validarEntradaAnalisisIA(cuerpo) {
  if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo)
      || Object.keys(cuerpo).some(campo => !CAMPOS_PERMITIDOS.includes(campo))) {
    throw boom.badRequest('Envía solo el alcance y los criterios del análisis.');
  }
  const { scope: alcance, symbol: simbolo, activeCores: coresActivos,
    dteHorizon: horizonteDias, extraSymbols: simbolosAdicionales = [] } = cuerpo;
  if (!['CANDIDATES', 'SYMBOL'].includes(alcance)) throw boom.badRequest('El alcance debe ser CANDIDATES o SYMBOL.');
  if (alcance === 'CANDIDATES' ? Object.hasOwn(cuerpo, 'symbol') : Object.hasOwn(cuerpo, 'extraSymbols')) {
    throw boom.badRequest('Usa symbol para SYMBOL y extraSymbols para CANDIDATES.');
  }
  if (!Array.isArray(simbolosAdicionales) || simbolosAdicionales.length > 25) {
    throw boom.badRequest('Envía hasta 25 símbolos adicionales en una lista.');
  }
  return {
    scope: alcance,
    symbol: alcance === 'SYMBOL' ? validarSimbolo(simbolo) : undefined,
    criteria: validarCriteriosEscaner({
      mode: 'BY_STRATEGY', strategy: 'COLLAR_SPREAD', activeCores: coresActivos, dteHorizon: horizonteDias, limit: 25,
      extraSymbols: [...new Set(simbolosAdicionales.map(validarSimbolo))],
    }),
  };
}

function obtenerFuentes(observaciones) {
  const fuentes = new Map();
  for (const observacion of observaciones) {
    if (typeof observacion?.source !== 'string' || !Number.isFinite(Date.parse(observacion.observedAt))) continue;
    const { source: fuente, observedAt: fechaObservacion, reference: referencia } = observacion;
    const referenciaValida = typeof referencia === 'string' ? referencia : null;
    fuentes.set(JSON.stringify([fuente, fechaObservacion, referenciaValida]), {
      source: fuente, observedAt: fechaObservacion, reference: referenciaValida,
    });
  }
  return [...fuentes.values()].slice(0, 4);
}

function construirEvidencia(fila) {
  const evidencia = [];
  const agregar = (id, etiqueta, detalle, observaciones = [], estado = 'AVAILABLE') => {
    const fuentes = obtenerFuentes(observaciones);
    if (fuentes.length) {
      evidencia.push({ id: `${fila.symbol}/${id}`, label: etiqueta, detail: detalle, status: estado, sources: fuentes });
    }
  };
  const formatearMetrica = (etiqueta, valor, unidad = '') => Number.isFinite(valor) ? `${etiqueta} ${valor}${unidad}` : null;
  const unirDetalles = (...valores) => valores.filter(Boolean).join(' · ');
  const {
    '001': tecnico, '002': fundamental, '003': senalesDirectas, '004': collar,
    '005': institucional, '006': noticias, '007': confluencia,
  } = fila.cores;

  if (tecnico?.result) {
    const { trend: tendencia, indicators: indicadores } = tecnico.result;
    agregar('technical', 'Análisis técnico', unirDetalles(`Tendencia ${tendencia}`,
      formatearMetrica('RSI', indicadores?.rsi?.value), formatearMetrica('ADX', indicadores?.adx?.value)),
    tecnico.evidence, tecnico.status);
  }
  if (fundamental?.result) {
    const { classification: clasificacion, event: evento, altman, valuation: valoracion, indicators: indicadores } = fundamental.result;
    const eventoVerificado = ['HIGH', 'MEDIUM', 'LOW'].includes(evento?.risk);
    const observaciones = fundamental.evidence ?? [];
    const observacionesFinancieras = eventoVerificado ? observaciones.slice(0, -1) : observaciones;
    agregar('fundamental', 'Viabilidad y valoración', unirDetalles(clasificacion, formatearMetrica('Altman', altman?.value),
      altman && `Umbrales Altman ${altman.lower} y ${altman.upper}`, valoracion, formatearMetrica('P/E', indicadores?.pe),
      formatearMetrica('Flujo de caja operativo', indicadores?.operatingCashFlow, ' USD'), formatearMetrica('Margen operativo',
        Number.isFinite(indicadores?.operatingMargin) ? Number((indicadores.operatingMargin * 100).toFixed(1)) : null, ' %')),
    observacionesFinancieras, fundamental.status);
    if (eventoVerificado) {
      const periodo = evento.start === evento.end ? evento.start : `${evento.start} a ${evento.end}`;
      agregar('events', 'Resultados trimestrales', unirDetalles(`Riesgo ${evento.risk}`,
        `${evento.estimated ? 'Estimación' : 'Calendario informado'} ${periodo}`,
        formatearMetrica('Días hasta resultados', evento.days)), observaciones.slice(-1));
    }
  }
  if (senalesDirectas?.result) {
    agregar('signal', 'Señales directas', unirDetalles(senalesDirectas.result.signal, senalesDirectas.result.rule),
      senalesDirectas.evidence, senalesDirectas.status);
  }
  if (collar?.result) {
    const {
      eligible: elegible, expiration: vencimiento, put, call, netPremiumPerShare: primaNetaPorAccion,
      maxLoss: perdidaMaxima, maxProfit: gananciaMaxima, breakEven: puntoDeEquilibrio, shares: acciones,
    } = collar.result;
    const observaciones = collar.evidence ?? [];
    agregar('collar', 'Collar Spread', elegible
      ? unirDetalles(`Vencimiento ${vencimiento}`, formatearMetrica('Piso Put', put?.strike, ' USD/acción'),
        formatearMetrica('Techo Call', call?.strike, ' USD/acción'),
        formatearMetrica('Prima neta por pagar (negativa si es crédito)', primaNetaPorAccion, ' USD/acción'),
        formatearMetrica('Acciones cubiertas', acciones), formatearMetrica('Pérdida máxima', perdidaMaxima, ' USD'),
        formatearMetrica('Ganancia máxima', gananciaMaxima, ' USD'),
        formatearMetrica('Punto de equilibrio', puntoDeEquilibrio, ' USD/acción'), 'Antes de comisiones')
      : 'La cadena evaluada no contiene un collar con liquidez y costo verificables.',
    elegible ? [...observaciones.slice(-2), ...observaciones.slice(0, 1)] : observaciones, collar.status);
  }
  if (institucional?.result) {
    agregar('flow', 'Flujo de opciones', `Dirección observada en la muestra ${institucional.result.direction}`,
      institucional.evidence, institucional.status);
  }
  if (noticias?.result) {
    agregar('news', 'Noticias', unirDetalles(`Sentimiento estimado ${noticias.result.sentiment}`,
      formatearMetrica('Noticias observadas', noticias.result.observed)), noticias.evidence, noticias.status);
  }
  if (confluencia?.result) {
    const { score: puntaje, signal: senal, conflicts: conflictos } = confluencia.result;
    agregar('confluence', 'Confluencia', unirDetalles(formatearMetrica('Puntaje', puntaje, ' / 100'), senal,
      conflictos?.length ? 'Hay señales en conflicto' : null), confluencia.evidence?.slice(0, 1), confluencia.status);
  }
  return evidencia;
}

function motivoDatosInsuficientes(fila, evidencia) {
  if (fila?.exclusionType === 'INSUFFICIENT_DATA') return fila.reason;
  const evento = fila?.cores['002']?.result?.event;
  if (!evento || evento.risk === 'UNVERIFIED') {
    return evento?.reason ?? 'No hay una fecha de resultados verificable.';
  }
  if (!['fundamental', 'collar', 'events'].every(id => evidencia.some(dato => dato.id === `${fila.symbol}/${id}`))) {
    return 'Falta evidencia fechada para la viabilidad, el collar o el calendario de resultados.';
  }
  return null;
}

function veredictoDelEscaner(simbolo, veredicto, motivo, dato) {
  return { symbol: simbolo, verdict: veredicto, reasons: [{ text: motivo, evidenceId: dato?.id ?? null }], risks: [],
    evidence: dato ? [dato] : [] };
}

function validarRecomendaciones(respuesta, alcance, activos) {
  const lista = respuesta?.recommendations;
  const errorRespuestaInvalida = () => boom.badGateway('El análisis de IA no coincide con la evidencia disponible.');
  if (!Array.isArray(lista) || (alcance === 'SYMBOL' ? lista.length !== 1 : lista.length > 3)) {
    throw errorRespuestaInvalida();
  }
  const simbolosUsados = new Set();
  return lista.map(recomendacion => {
    const activo = activos.find(valor => valor.symbol === recomendacion?.symbol);
    if (!activo || simbolosUsados.has(recomendacion.symbol) || !VEREDICTOS.includes(recomendacion.verdict)
        || (alcance === 'CANDIDATES' && recomendacion.verdict !== 'CONSIDER')) throw errorRespuestaInvalida();
    simbolosUsados.add(recomendacion.symbol);
    const idsCitados = new Set();
    const validarPuntos = (puntos, minimo) => {
      if (!Array.isArray(puntos) || puntos.length < minimo || puntos.length > 2) throw errorRespuestaInvalida();
      return puntos.map(punto => {
        const texto = typeof punto?.text === 'string' ? punto.text.trim() : '';
        const id = punto?.evidenceId;
        if (!texto || texto.length > 480) throw errorRespuestaInvalida();
        if (id !== null) {
          if (!activo.evidence.some(dato => dato.id === id)) throw errorRespuestaInvalida();
          idsCitados.add(id);
        }
        return { text: texto, evidenceId: id };
      });
    };
    const motivos = validarPuntos(recomendacion.reasons, 1);
    const riesgos = validarPuntos(recomendacion.risks, 0);
    return { symbol: activo.symbol, verdict: recomendacion.verdict, reasons: motivos, risks: riesgos,
      evidence: activo.evidence.filter(dato => idsCitados.has(dato.id)) };
  });
}

function crearAnalisisIA({ run: ejecutarEscaner = ejecutarEscanerEstrategias, prepare: prepararProveedor = crearProveedorIA() } = {}) {
  return async function analizar({ scope: alcance, symbol: simbolo, criteria: criterios }, senalCancelacion) {
    const consultarModelo = prepararProveedor();
    const { asOf: fechaCorte, candidates: candidatas, excluded: excluidas } = await ejecutarEscaner(criterios, { symbol: simbolo });
    senalCancelacion?.throwIfAborted();
    const respuesta = { scope: alcance, strategy: criterios.strategy, dteHorizon: criterios.dteHorizon, asOf: fechaCorte,
      model: null, status: 'COMPLETE', message: null, recommendations: [] };
    let activos;
    if (alcance === 'SYMBOL') {
      const fila = [...candidatas, ...excluidas].find(empresa => empresa.symbol === simbolo);
      if (!fila) {
        return { ...respuesta, status: 'INSUFFICIENT_DATA',
          recommendations: [veredictoDelEscaner(simbolo, 'INSUFFICIENT_DATA', 'El escáner no tiene diagnósticos para este ticker.')] };
      }
      const evidencia = construirEvidencia(fila);
      if (['VIABILITY_VETO', 'NO_COLLAR'].includes(fila.exclusionType)) {
        const id = fila.exclusionType === 'NO_COLLAR' ? 'collar' : 'fundamental';
        return { ...respuesta, recommendations: [veredictoDelEscaner(simbolo, 'AVOID', fila.reason,
          evidencia.find(dato => dato.id === `${simbolo}/${id}`))] };
      }
      const motivo = motivoDatosInsuficientes(fila, evidencia);
      if (motivo) {
        return { ...respuesta, status: 'INSUFFICIENT_DATA',
          recommendations: [veredictoDelEscaner(simbolo, 'INSUFFICIENT_DATA', motivo)] };
      }
      activos = [{ symbol: simbolo, evidence: evidencia }];
    } else {
      activos = candidatas.flatMap(fila => {
        const evidencia = construirEvidencia(fila);
        return motivoDatosInsuficientes(fila, evidencia) ? [] : [{ symbol: fila.symbol, evidence: evidencia }];
      }).slice(0, 10);
      if (!activos.length) {
        const datosIncompletos = candidatas.length > 0 || excluidas.some(fila => fila.exclusionType === 'INSUFFICIENT_DATA');
        return { ...respuesta, status: datosIncompletos ? 'INSUFFICIENT_DATA' : 'NO_SUGGESTIONS',
          message: datosIncompletos ? 'No hay candidatas con evidencia suficiente para esta consulta.'
            : 'Ninguna empresa cumple los criterios de viabilidad y liquidez para este horizonte.' };
      }
    }

    const { model: modelo, result: resultado } = await consultarModelo({
      scope: alcance, strategy: respuesta.strategy, dteHorizon: respuesta.dteHorizon, asOf: fechaCorte,
      assets: activos.map(({ symbol: ticker, evidence: evidencia }) => ({
        symbol: ticker, evidence: evidencia.map(({ id, label: etiqueta, detail: detalle, status: estado }) => ({
          id, label: etiqueta, detail: detalle, status: estado,
        })),
      })),
    }, senalCancelacion);
    const recomendaciones = validarRecomendaciones(resultado, alcance, activos);
    return recomendaciones.length ? { ...respuesta, model: modelo, recommendations: recomendaciones }
      : { ...respuesta, model: modelo, status: 'NO_SUGGESTIONS', message: 'La IA no destacó ninguna candidata con la evidencia evaluada.' };
  };
}

const ejecutarAnalisisIA = crearAnalisisIA();

export {
  validarEntradaAnalisisIA as parseAiAnalysisInput,
  crearAnalisisIA as createAiAnalysis,
  ejecutarAnalisisIA as runAiAnalysis,
};
