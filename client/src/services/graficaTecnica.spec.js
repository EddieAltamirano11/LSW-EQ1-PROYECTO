import { afterEach, describe, expect, it, vi } from 'vitest';
import { cargarSerieTecnica, prepararEventosDelActivo, prepararGraficaTecnica, prepararNivelesDelActivo, resumenTecnico } from './graficaTecnica';
import { serieTecnica } from './__fixtures__/serieTecnica';
import { screener } from './__fixtures__/screener';

describe('prepararGraficaTecnica', () => {
  const grafica = prepararGraficaTecnica(serieTecnica);

  it('conserva las velas y agrega las sesiones futuras como espacio para la proyección', () => {
    expect(grafica.velas).toEqual(serieTecnica.candles.map(({ time, open, high, low, close }) => ({ time, open, high, low, close })));
    expect(grafica.futuras).toEqual(serieTecnica.upcoming.map(time => ({ time })));
  });

  it('conserva el volumen de cada vela y omite las sesiones sin volumen disponible', () => {
    expect(grafica.volumen).toEqual([
      { time: '2026-11-18', value: 1000, direccion: 'alza' },
      { time: '2026-11-19', value: 1200, direccion: 'alza' },
      { time: '2026-11-20', value: 900, direccion: 'baja' },
    ]);
    const [primera, segunda, tercera] = serieTecnica.candles;
    const candles = [{ ...primera, volume: 0 }, { ...segunda, volume: null }, { ...tercera, volume: -1 }];
    expect(prepararGraficaTecnica({ ...serieTecnica, candles }).volumen).toEqual([
      { time: primera.time, value: 0, direccion: 'alza' },
    ]);
  });

  it('rotula los niveles por puntaje con su banda', () => {
    expect(grafica.niveles.map(nivel => [nivel.etiqueta, nivel.price, nivel.lower, nivel.upper])).toEqual([
      ['S1', 220, 219, 221], ['S2', 215, 214, 216], ['R1', 240, 239, 241],
    ]);
  });

  it('solo dibuja las ventanas proyectadas con fechas y las rotula como proyección', () => {
    expect(grafica.ventanas).toEqual([
      { escala: 'short', etiqueta: 'Proyección corta', direction: 'DOWN', from: '2026-11-30', to: '2026-12-03', openEnded: false },
    ]);
  });

  it('ordena los tramos en una fila por escala', () => {
    expect(grafica.tramos.filter(tramo => tramo.fila === 0)).toHaveLength(1);
    expect(grafica.tramos.filter(tramo => tramo.fila === 1).map(tramo => tramo.direction)).toEqual(['UP', 'SIDEWAYS']);
    expect(grafica.medias.map(media => media.etiqueta)).toEqual(['SMA200', 'EMA50', 'EMA20']);
  });

  it('calcula Bollinger (20, 2) solo cuando hay veinte cierres por punto', () => {
    expect(grafica.bollinger).toEqual([]);
    const candles = Array.from({ length: 21 }, (_, i) => ({
      time: `2026-10-${String(i + 1).padStart(2, '0')}`,
      close: i === 20 ? 120 : 100,
    }));
    const [superior, media, inferior] = prepararGraficaTecnica({ ...serieTecnica, candles }).bollinger;
    expect(media).toEqual([{ time: '2026-10-20', value: 100 }, { time: '2026-10-21', value: 101 }]);
    expect(superior[1].value).toBeCloseTo(101 + 2 * Math.sqrt(19));
    expect(inferior[1].value).toBeCloseTo(101 - 2 * Math.sqrt(19));
  });
});

describe('capas del activo seleccionado', () => {
  const collar = screener.candidates[0].cores['004'].result;

  it('usa el spot del activo y los niveles del mismo payoff del Core 004', () => {
    const { niveles, payoff } = prepararNivelesDelActivo(232, collar);
    expect(niveles.map(({ id, precio }) => [id, precio])).toEqual([
      ['spot', 232], ['put', collar.put.strike], ['equilibrio', collar.breakEven], ['call', collar.call.strike],
    ]);
    expect(payoff.maxProfit).toBe(collar.maxProfit);
  });

  it('omite el collar si el diagnóstico está incompleto y el spot si falta la cotización', () => {
    expect(prepararNivelesDelActivo(null, { ...collar, put: null })).toEqual({ niveles: [], payoff: null });
  });

  it('respeta las fechas de noticias y la ventana de resultados del proveedor', () => {
    const ventana = { start: '2026-11-26', end: '2026-11-30', estimated: true };
    const cores = {
      '002': { result: { event: ventana } },
      '006': { result: { headlines: [
        { headline: 'Noticia tras el cierre', publishedAt: '2026-11-21T01:30:00Z' },
        { headline: 'Noticia de fin de semana', publishedAt: '2026-11-22T14:00:00Z' },
      ] } },
    };
    const eventos = prepararEventosDelActivo(serieTecnica, cores);
    expect(eventos.noticias.map(noticia => noticia.fecha)).toEqual(['2026-11-20', '2026-11-22']);
    expect(eventos.diasNoticias).toEqual(['2026-11-20']);
    expect(eventos.resultados).toEqual({ desde: '2026-11-26', hasta: '2026-11-30', estimado: true });
    expect(eventos.ventanaResultados).toEqual({ desde: '2026-11-27', hasta: '2026-11-30' });
    const sinVerificar = prepararEventosDelActivo(serieTecnica, {
      '002': { result: { event: { ...ventana, risk: 'UNVERIFIED' } } },
    });
    expect(sinVerificar.resultados.desde).toBeNull();
    expect(sinVerificar.ventanaResultados).toBeNull();
  });
});

describe('resumenTecnico', () => {
  it('describe en texto el periodo, las tendencias, los niveles y la proyección con su precisión', () => {
    const texto = resumenTecnico(serieTecnica).join(' ');
    expect(texto).toContain('AAPL');
    expect(texto).toContain('3 velas diarias del 2026-11-18 al 2026-11-20');
    expect(texto).toContain('Volumen de la última sesión: 900 acciones');
    expect(texto).toContain('corta SIDEWAYS desde 2026-11-02');
    expect(texto).toContain('220.00 (4 toques)');
    expect(texto).toContain('240.00 (3 toques)');
    expect(texto).toContain('cambio a DOWN entre 2026-11-30 y 2026-12-03');
    expect(texto).toContain('25 % en 4 casos');
    expect(texto).toContain('Las medias se separan');
  });
});

describe('cargarSerieTecnica', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('pide la serie del símbolo con la sesión', async () => {
    const fetchSimulado = vi.fn(async () => new Response(JSON.stringify(serieTecnica), { status: 200 }));
    vi.stubGlobal('fetch', fetchSimulado);
    await expect(cargarSerieTecnica({ apiBase: 'http://api', token: 't', symbol: 'AAPL' })).resolves.toEqual(serieTecnica);
    const [url, opciones] = fetchSimulado.mock.calls[0];
    expect(url).toBe('http://api/api/v2/strategy-screener/technical/AAPL');
    expect(opciones.headers.Authorization).toBe('Bearer t');
  });

  it('entrega la causa que reporta la API cuando no hay datos', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message: 'Datos reales insuficientes. Serie 1Day incompleta.' }), { status: 503 })));
    await expect(cargarSerieTecnica({ apiBase: '', token: 't', symbol: 'AAPL' })).rejects.toThrow('Serie 1Day incompleta');
  });
});
