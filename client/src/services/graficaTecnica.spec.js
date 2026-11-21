import { afterEach, describe, expect, it, vi } from 'vitest';
import { cargarSerieTecnica, prepararGraficaTecnica, resumenTecnico } from './graficaTecnica';
import { serieTecnica } from './__fixtures__/serieTecnica';

describe('prepararGraficaTecnica', () => {
  const grafica = prepararGraficaTecnica(serieTecnica);

  it('conserva las velas y agrega las sesiones futuras como espacio para la proyección', () => {
    expect(grafica.velas).toEqual(serieTecnica.candles.map(({ time, open, high, low, close }) => ({ time, open, high, low, close })));
    expect(grafica.futuras).toEqual(serieTecnica.upcoming.map(time => ({ time })));
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
});

describe('resumenTecnico', () => {
  it('describe en texto el periodo, las tendencias, los niveles y la proyección con su precisión', () => {
    const texto = resumenTecnico(serieTecnica).join(' ');
    expect(texto).toContain('AAPL');
    expect(texto).toContain('3 velas diarias del 2026-11-18 al 2026-11-20');
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
