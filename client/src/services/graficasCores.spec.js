import { describe, expect, it } from 'vitest';
import { contribuciones, payoffCollar, resumenContribucion, resumenPayoff } from './graficasCores';

// Datos de prueba con la forma del resultado del Core 004 y del 007; no son cotizaciones reales.
const collar = {
  eligible: true, underlyingPrice: 343.4, expiration: '2026-12-31', shares: 100,
  put: { strike: 330, ask: 9.2 }, call: { strike: 360, bid: 5.2 },
  netPremiumPerShare: 4, maxLoss: 1740, maxProfit: 1260, breakEven: 347.4,
};
const confluencia = {
  score: 68.63, signal: 'HOLD',
  drivers: [
    { id: '001', weight: 0.225, score: 63.8, direction: 0 },
    { id: '002', weight: 0.25, score: 79.08, direction: 0 },
    { id: '003', weight: 0.15, score: 65, direction: 0 },
    { id: '005', weight: 0.1875, score: 66, direction: 1 },
    { id: '006', weight: 0.1875, score: 66, direction: -1 },
  ],
  conflicts: [{ bullish: ['005'], bearish: ['006'] }],
};

describe('payoffCollar', () => {
  const payoff = payoffCollar(collar);

  it('calcula las mismas métricas que el Core 004', () => {
    expect(payoff.maxLoss).toBe(collar.maxLoss);
    expect(payoff.maxProfit).toBe(collar.maxProfit);
    expect(payoff.breakEven).toBe(collar.breakEven);
  });

  it('dibuja la pérdida máxima hasta el strike del Put, una recta hasta el del Call y la ganancia máxima después', () => {
    const [inicio, put, call, fin] = payoff.puntos;
    expect([put.precio, put.resultado]).toEqual([330, -1740]);
    expect([call.precio, call.resultado]).toEqual([360, 1260]);
    expect(inicio.resultado).toBe(-1740);
    expect(fin.resultado).toBe(1260);
    expect(inicio.precio).toBeLessThan(330);
    expect(fin.precio).toBeGreaterThan(360);
  });

  it('no inventa un payoff sin collar', () => {
    expect(payoffCollar({ eligible: false, reason: 'Sin par líquido.' })).toBeNull();
  });

  it('resume el payoff en texto', () => {
    const texto = resumenPayoff(collar, payoff);
    expect(texto).toContain('Put 330');
    expect(texto).toContain('Call 360');
    expect(texto).toContain('347.40');
    expect(texto).toContain('1,740.00');
  });
});

describe('contribuciones', () => {
  const filas = contribuciones(confluencia);

  it('multiplica peso efectivo por puntaje y la suma coincide con el puntaje de la confluencia', () => {
    expect(filas.find(fila => fila.id === '001').aporte).toBeCloseTo(0.225 * 63.8, 6);
    const suma = filas.reduce((total, fila) => total + fila.aporte, 0);
    expect(Math.abs(suma - confluencia.score)).toBeLessThan(0.01);
  });

  it('ordena de mayor a menor aporte y marca los cores en conflicto', () => {
    expect(filas[0].id).toBe('002');
    expect(filas.find(fila => fila.id === '005').conflicto).toBe('alcista');
    expect(filas.find(fila => fila.id === '006').conflicto).toBe('bajista');
    expect(filas.find(fila => fila.id === '001').conflicto).toBeNull();
  });

  it('resume la contribución en texto', () => {
    const texto = resumenContribucion(confluencia, filas);
    expect(texto).toContain('68.63');
    expect(texto).toContain('Fundamental');
    expect(texto).toMatch(/conflicto/i);
  });
});
