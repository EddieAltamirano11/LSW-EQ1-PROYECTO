// Series diarias deterministas para probar el Core 001 con dos años de histórico.
// Son datos de prueba con forma conocida (escalones, tendencias y mínimos repetidos); no representan mercado real.

export function sesionesHasta(fin, cantidad) {
  const fechas = [];
  const dia = new Date(`${fin}T12:00:00Z`);
  while (fechas.length < cantidad) {
    if (dia.getUTCDay() !== 0 && dia.getUTCDay() !== 6) fechas.unshift(dia.toISOString().slice(0, 10));
    dia.setUTCDate(dia.getUTCDate() - 1);
  }
  return fechas;
}

export function sesionesDespues(inicio, cantidad) {
  const fechas = [];
  const dia = new Date(`${inicio}T12:00:00Z`);
  while (fechas.length < cantidad) {
    dia.setUTCDate(dia.getUTCDate() + 1);
    if (dia.getUTCDay() !== 0 && dia.getUTCDay() !== 6) fechas.push(dia.toISOString().slice(0, 10));
  }
  return fechas;
}

export function velas(fechas, precio, { rango = 0.5, minimo, volumen = () => 1000 } = {}) {
  return fechas.map((fecha, i) => {
    const close = precio(i);
    return { at: Date.parse(`${fecha}T12:00:00Z`), open: close, high: close + rango, low: minimo?.(i) ?? close - rango, close, volume: volumen(i) };
  });
}

export function historial(diarias, calendar) {
  return { series: { '1Day': diarias, '1Hour': diarias.slice(-80), '15Min': diarias.slice(-80) }, evidence: [], calendar };
}

// La EMA50 cruza al alza la SMA200 el día del escalón y se mantiene arriba.
export function serieConEscalon(fechaEscalon, fin = '2026-11-13', sesiones = 500) {
  const fechas = sesionesHasta(fin, sesiones);
  return velas(fechas, i => (fechas[i] >= fechaEscalon ? 200 : 100));
}

// Mínimo en 90 tocado cuatro veces y otro mínimo en 97, más cercano al precio, tocado una sola vez.
export function serieConSoportes() {
  const fechas = sesionesHasta('2026-11-13', 300);
  const minimos = new Map([[200, 90], [225, 90], [250, 90], [275, 90], [285, 97]]);
  return velas(fechas, () => 100, { rango: 1, minimo: i => minimos.get(i) ?? 99 });
}

// Tendencia alcista seguida de una caída reciente: la EMA20 baja hacia la EMA50.
export function serieQueConverge() {
  const fechas = sesionesHasta('2026-11-13', 500);
  return velas(fechas, i => (i < 485 ? 100 + 0.5 * i : 100 + 0.5 * 484 - 0.5 * (i - 484)));
}

// Crecimiento compuesto: las medias se separan cada vez más.
export function serieQueSeSepara() {
  const fechas = sesionesHasta('2026-11-13', 500);
  return velas(fechas, i => 100 * 1.004 ** i);
}
