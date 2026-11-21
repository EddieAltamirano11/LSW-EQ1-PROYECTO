// Histórico diario del Core 001: niveles de soporte y resistencia puntuados, tendencias en tres escalas
// con su fecha de confirmación, tramos de tendencia y proyección de cruces de medias con su precisión medida.
// Todo se calcula con velas observadas; la proyección es informativa y no entra al puntaje del core.

const formatoFechaEste = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });

export const clamp = (value, lower = 0, upper = 100) => Math.max(lower, Math.min(upper, value));
export const round = (value, decimals = 2) => Number(value.toFixed(decimals));
export const mean = values => values.reduce((sum, item) => sum + item, 0) / values.length;
export const fecha = at => formatoFechaEste.format(at);

export function smooth(values, period, factor = 2 / (period + 1)) {
  if (values.length < period) return [];
  const averages = [mean(values.slice(0, period))];
  for (const value of values.slice(period)) averages.push(averages.at(-1) + factor * (value - averages.at(-1)));
  return averages;
}

export const PARAMETROS = Object.freeze({
  velasSma200: 220,
  persistencia: 3,
  tramoMinimo: 10,
  horizonte: 60,
  ventanaPendiente: 20,
  bandaNiveles: 0.2,
  vidaMediaToques: 120,
  maximoToques: 5,
  pesosNivel: Object.freeze({ toques: 0.4, antiguedad: 0.25, volumen: 0.2, proximidad: 0.15 }),
});

export const alinear = (serie, longitud) => Array(Math.max(0, longitud - serie.length)).fill(null).concat(serie);
const emaAlineada = (valores, periodo) => alinear(smooth(valores, periodo), valores.length);

function smaAlineada(valores, periodo) {
  let suma = 0;
  return valores.map((valor, i) => {
    suma += valor - (i >= periodo ? valores[i - periodo] : 0);
    return i >= periodo - 1 ? suma / periodo : null;
  });
}

export const zonaRsi = valor => (valor < 30 ? 'OVERSOLD' : valor > 70 ? 'OVERBOUGHT' : 'NEUTRAL');
export const claseAdx = valor => (valor < 20 ? 'NO_TREND' : valor < 25 ? 'WEAK' : valor < 50 ? 'STRONG' : 'VERY_STRONG');

// Medias alineadas con las velas (null mientras no hay periodo completo); las usan las escalas y la gráfica técnica.
export function mediasMoviles(cierres) {
  return { sma200: smaAlineada(cierres, 200), ema50: emaAlineada(cierres, 50), ema20: emaAlineada(cierres, 20) };
}

// Ancho con el que se agrupan los pivotes de un mismo nivel; la gráfica lo usa como banda del nivel.
export const toleranciaNiveles = (atr, cierre) => Math.max(atr * 0.35, cierre * 0.002);

export function nivelesPuntuados(barras, atr) {
  const { bandaNiveles, vidaMediaToques, maximoToques, pesosNivel } = PARAMETROS;
  const cierre = barras.at(-1).close;
  const tolerancia = toleranciaNiveles(atr, cierre);
  const volumenMedio = mean(barras.map(barra => barra.volume));
  const pivotes = [];
  for (let i = 2; i < barras.length - 2; i++) {
    const vecinos = [barras[i - 2], barras[i - 1], barras[i + 1], barras[i + 2]];
    if (vecinos.every(vecino => vecino.low > barras[i].low)) pivotes.push({ precio: barras[i].low, indice: i, volumen: barras[i].volume });
    if (vecinos.every(vecino => vecino.high < barras[i].high)) pivotes.push({ precio: barras[i].high, indice: i, volumen: barras[i].volume });
  }
  const grupos = [];
  for (const pivote of pivotes.sort((a, b) => a.precio - b.precio)) {
    const grupo = grupos.at(-1);
    if (grupo && Math.abs(pivote.precio - mean(grupo.map(item => item.precio))) <= tolerancia) grupo.push(pivote);
    else grupos.push([pivote]);
  }
  const ultimo = barras.length - 1;
  const niveles = grupos.map(grupo => {
    const precio = mean(grupo.map(item => item.precio));
    const indiceUltimo = Math.max(...grupo.map(item => item.indice));
    const distancia = (precio - cierre) / cierre;
    const factores = {
      toques: Math.min(grupo.length / maximoToques, 1),
      antiguedad: 0.5 ** ((ultimo - indiceUltimo) / vidaMediaToques),
      volumen: volumenMedio > 0 ? clamp(mean(grupo.map(item => item.volumen)) / volumenMedio / 2, 0, 1) : 0,
      proximidad: clamp(1 - Math.abs(distancia) / bandaNiveles, 0, 1),
    };
    const puntaje = 100 * Object.entries(pesosNivel).reduce((suma, [clave, peso]) => suma + peso * factores[clave], 0);
    return { price: round(precio), touches: grupo.length, lastTouch: fecha(barras[indiceUltimo].at), score: round(puntaje), distancePct: round(distancia * 100) };
  }).filter(nivel => Math.abs(nivel.distancePct) <= bandaNiveles * 100);
  const mejores = lista => lista.sort((a, b) => b.score - a.score || Math.abs(a.distancePct) - Math.abs(b.distancePct)).slice(0, 3);
  return { support: mejores(niveles.filter(nivel => nivel.price < cierre)), resistance: mejores(niveles.filter(nivel => nivel.price > cierre)) };
}

// Un cambio de estado solo cuenta si se mantiene PARAMETROS.persistencia sesiones; se fecha desde su primera sesión.
function confirmarEstados(crudos) {
  const confirmados = Array(crudos.length).fill(null);
  let actual = null;
  let candidato = null;
  let inicioCandidato = 0;
  let cuenta = 0;
  crudos.forEach((estado, i) => {
    if (estado === null) return;
    if (estado === actual) {
      candidato = null;
      cuenta = 0;
      confirmados[i] = actual;
      return;
    }
    if (estado === candidato) cuenta++;
    else {
      candidato = estado;
      inicioCandidato = i;
      cuenta = 1;
    }
    if (cuenta >= PARAMETROS.persistencia) {
      actual = candidato;
      candidato = null;
      cuenta = 0;
      confirmados.fill(actual, inicioCandidato, i + 1);
    } else confirmados[i] = actual;
  });
  return confirmados;
}

function tramos(confirmados, barras) {
  const corridas = [];
  confirmados.forEach((estado, i) => {
    if (estado === null) return;
    const ultima = corridas.at(-1);
    if (ultima && ultima.direction === estado && ultima.fin === i - 1) ultima.fin = i;
    else corridas.push({ direction: estado, inicio: i, fin: i });
  });
  const fusionadas = [];
  corridas.forEach((corrida, k) => {
    const previa = fusionadas.at(-1);
    const breve = corrida.fin - corrida.inicio + 1 < PARAMETROS.tramoMinimo && k < corridas.length - 1;
    if (previa && (breve || previa.direction === corrida.direction)) previa.fin = corrida.fin;
    else fusionadas.push({ ...corrida });
  });
  return fusionadas.map(({ direction, inicio, fin }) => ({
    direction, start: fecha(barras[inicio].at), end: fecha(barras[fin].at), sessions: fin - inicio + 1,
    changePct: round((barras[fin].close / barras[inicio].close - 1) * 100),
  }));
}

function escala(crudos, barras, disponible, motivo) {
  if (!disponible) return { estado: { available: false, reason: motivo }, tramos: [] };
  const confirmados = confirmarEstados(crudos);
  const final = confirmados.length - 1;
  const direccion = confirmados[final];
  if (direccion === null) return { estado: { available: false, reason: 'No hay una tendencia confirmada en el periodo.' }, tramos: [] };
  let inicio = final;
  while (inicio > 0 && confirmados[inicio - 1] === direccion) inicio--;
  return {
    estado: { available: true, direction: direccion, since: fecha(barras[inicio].at), sessions: final - inicio + 1 },
    tramos: tramos(confirmados, barras),
  };
}

export function escalasDeTendencia(barras, adx) {
  const cierres = barras.map(barra => barra.close);
  const { sma200, ema50, ema20 } = mediasMoviles(cierres);
  const conSma200 = barras.length >= PARAMETROS.velasSma200;
  const conEma50 = ema50.some(valor => valor !== null);
  const motivoSma200 = `Se requieren al menos ${PARAMETROS.velasSma200} velas diarias para la SMA200; hay ${barras.length}.`;
  const comparar = (rapida, lenta) => (rapida > lenta ? 'UP' : rapida < lenta ? 'DOWN' : 'SIDEWAYS');
  const primaria = escala(cierres.map((cierre, i) => {
    if (i < 20 || sma200[i - 20] === null) return null;
    const pendiente = sma200[i] - sma200[i - 20];
    return cierre > sma200[i] && pendiente > 0 ? 'UP' : cierre < sma200[i] && pendiente < 0 ? 'DOWN' : 'SIDEWAYS';
  }), barras, conSma200, motivoSma200);
  const intermedia = escala(cierres.map((_, i) => (sma200[i] === null ? null : comparar(ema50[i], sma200[i]))), barras, conSma200, motivoSma200);
  const corta = escala(cierres.map((_, i) => {
    if (ema50[i] === null || adx[i] == null) return null;
    return adx[i] < 20 ? 'SIDEWAYS' : comparar(ema20[i], ema50[i]);
  }), barras, conEma50, 'Se requieren al menos 50 velas diarias para la EMA50.');
  return {
    scales: { primary: primaria.estado, intermediate: intermedia.estado, short: corta.estado },
    segments: { primary: primaria.tramos, intermediate: intermedia.tramos, short: corta.tramos },
    diferencias: {
      intermediate: cierres.map((_, i) => (sma200[i] === null ? null : ema50[i] - sma200[i])),
      short: cierres.map((_, i) => (ema50[i] === null ? null : ema20[i] - ema50[i])),
    },
    disponibles: { intermediate: conSma200, short: conEma50 },
  };
}

function regresion(valores) {
  const xMedia = (valores.length - 1) / 2;
  const yMedia = mean(valores);
  let sxx = 0;
  let sxy = 0;
  valores.forEach((y, x) => {
    sxx += (x - xMedia) ** 2;
    sxy += (x - xMedia) * (y - yMedia);
  });
  const pendiente = sxy / sxx;
  const residuos = valores.reduce((suma, y, x) => suma + (y - (yMedia + pendiente * (x - xMedia))) ** 2, 0);
  return { pendiente, errorEstandar: Math.sqrt(residuos / (valores.length - 2) / sxx) };
}

// Proyecta en cuántas sesiones se cruzarían dos medias si se mantiene la pendiente reciente de su diferencia.
export function proyectarCruce(diferencias, indice, { horizonte = PARAMETROS.horizonte, ventana = PARAMETROS.ventanaPendiente } = {}) {
  if (indice < ventana - 1) return null;
  const tramo = diferencias.slice(indice - ventana + 1, indice + 1);
  if (tramo.some(valor => valor === null)) return null;
  const actual = tramo.at(-1);
  const { pendiente, errorEstandar } = regresion(tramo);
  if (actual === 0 || pendiente === 0 || Math.sign(pendiente) === Math.sign(actual)) return { converge: false };
  const centro = Math.abs(actual / pendiente);
  if (centro > horizonte) return { converge: true, dentroDelHorizonte: false };
  const rapida = Math.abs(pendiente) + 1.96 * errorEstandar;
  const lenta = Math.abs(pendiente) - 1.96 * errorEstandar;
  const finLento = lenta > 0 ? Math.abs(actual) / lenta : Infinity;
  return {
    converge: true, dentroDelHorizonte: true, centro, direccion: actual > 0 ? 'DOWN' : 'UP',
    desde: Math.max(1, Math.floor(Math.abs(actual) / rapida)), hasta: Math.min(horizonte, Math.ceil(finLento)), abierta: finLento > horizonte,
  };
}

// Walk-forward: para cada cruce real se toma la primera proyección hecha dentro del mismo régimen y del horizonte.
export function precisionHistorica(diferencias, opciones = {}) {
  const horizonte = opciones.horizonte ?? PARAMETROS.horizonte;
  const cruces = [];
  for (let j = 1; j < diferencias.length; j++) {
    const previo = diferencias[j - 1];
    const actual = diferencias[j];
    if (previo !== null && actual !== null && previo !== 0 && Math.sign(previo) !== Math.sign(actual)) cruces.push(j);
  }
  const evaluaciones = [];
  cruces.forEach((cruce, k) => {
    const inicioRegimen = k > 0 ? cruces[k - 1] : 0;
    for (let t = Math.max(inicioRegimen, cruce - horizonte); t < cruce; t++) {
      const proyeccion = proyectarCruce(diferencias, t, opciones);
      if (!proyeccion?.dentroDelHorizonte) continue;
      evaluaciones.push({
        acierto: cruce >= t + proyeccion.desde && cruce <= t + proyeccion.hasta,
        error: Math.abs(cruce - (t + proyeccion.centro)),
      });
      break;
    }
  });
  const casos = evaluaciones.length;
  return {
    cases: casos,
    hitRate: casos ? round(evaluaciones.filter(evaluacion => evaluacion.acierto).length / casos) : null,
    meanErrorSessions: casos ? round(mean(evaluaciones.map(evaluacion => evaluacion.error)), 1) : null,
    insufficientSample: casos < 3,
  };
}

export function proyeccionDeEscala(diferencias, disponible, calendario, descripcion) {
  if (!disponible) return { available: false, reason: 'La escala no tiene velas suficientes para proyectar.' };
  const { horizonte, ventanaPendiente } = PARAMETROS;
  const accuracy = precisionHistorica(diferencias);
  const assumption = `Supone que se mantiene la pendiente de los últimos ${ventanaPendiente} días de la diferencia entre ${descripcion}.`;
  const proyeccion = proyectarCruce(diferencias, diferencias.length - 1);
  if (!proyeccion) return { available: false, reason: 'Faltan valores para estimar la pendiente reciente.', accuracy };
  if (!proyeccion.converge) return { available: true, projected: false, reason: 'Las medias se separan; no hay cambio proyectado.', assumption, accuracy };
  if (!proyeccion.dentroDelHorizonte) {
    return { available: true, projected: false, reason: `El cruce quedaría fuera del horizonte de ${horizonte} sesiones.`, assumption, accuracy };
  }
  const fechable = Array.isArray(calendario) && calendario.length >= proyeccion.hasta;
  return {
    available: true, projected: true, direction: proyeccion.direccion,
    sessions: { from: proyeccion.desde, to: proyeccion.hasta }, openEnded: proyeccion.abierta,
    window: fechable ? { from: calendario[proyeccion.desde - 1], to: calendario[proyeccion.hasta - 1] } : null,
    ...(fechable ? {} : { windowReason: 'El calendario bursátil disponible no alcanza para fechar la ventana.' }),
    assumption, accuracy,
  };
}
