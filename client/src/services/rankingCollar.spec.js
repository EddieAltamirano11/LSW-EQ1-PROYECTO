import { describe, expect, it } from 'vitest';
import { collarDeFila, exclusionDeFila } from './rankingCollar';

import { candidatoEscaner, filaCores } from './__fixtures__/ranking';

describe('collarDeFila', () => {
  it('usa el collar del Core 004 con primas observadas, débito normalizado, retorno sobre el spot y hora de cotización', () => {
    const collar = collarDeFila(candidatoEscaner, filaCores);
    expect(collar.origen).toBe('REAL');
    expect(collar.put).toEqual({ strike: 330, vencimiento: '2026-12-31', prima: 9.2, lado: 'ask' });
    expect(collar.call).toEqual({ strike: 360, vencimiento: '2026-12-31', prima: 5.2, lado: 'bid' });
    expect(collar.costoNeto).toEqual({ tipo: 'Débito', monto: 4 });
    expect(collar.retornoMaxPct).toBeCloseTo(1260 / 34340 * 100, 6);
    expect(collar.cotizadoEn).toBe('2026-11-20T20:55:30.000Z');
    expect(collar.horaCotizacion).toBe('15:55 ET');
  });

  it('normaliza el crédito del Core 004 y el costo cero', () => {
    const credito = structuredClone(filaCores);
    credito.cores['004'].result.netPremiumPerShare = -0.35;
    expect(collarDeFila(candidatoEscaner, credito).costoNeto).toEqual({ tipo: 'Crédito', monto: 0.35 });
    credito.cores['004'].result.netPremiumPerShare = 0;
    expect(collarDeFila(candidatoEscaner, credito).costoNeto).toEqual({ tipo: 'Costo cero', monto: 0 });
  });

  it('sin resultado de cores o sin collar del 004 usa el escáner marcado como teórico', () => {
    for (const fila of [null, { symbol: 'AAPL', cores: { '004': { status: 'UNAVAILABLE', result: null } } },
      { symbol: 'AAPL', cores: { '004': { status: 'AVAILABLE', result: { eligible: false, reason: 'Sin par.' } } } }]) {
      const collar = collarDeFila(candidatoEscaner, fila);
      expect(collar.origen).toBe('TEORICO');
      expect(collar.put).toEqual({ strike: 325, vencimiento: null, prima: 4.5, lado: 'teórica' });
      expect(collar.costoNeto).toEqual({ tipo: 'Crédito', monto: 0.3 });
      expect(collar.retornoMaxPct).toBe(4.92);
      expect(collar.probabilidadPct).toBe(88.1);
    }
  });

  it('el débito del escáner es negativo', () => {
    const debito = { ...candidatoEscaner, financialMetrics: { netDebitCredit: -1.25, maxReturnPct: 3 } };
    expect(collarDeFila(debito, null).costoNeto).toEqual({ tipo: 'Débito', monto: 1.25 });
  });
});

describe('exclusionDeFila', () => {
  it('distingue veto, sin collar y datos insuficientes con su causa', () => {
    expect(exclusionDeFila({ exclusionType: 'VIABILITY_VETO', reason: 'Veto de viabilidad MARGINAL.' }))
      .toEqual({ etiqueta: 'Veto de viabilidad', causa: 'Veto de viabilidad MARGINAL.', tipo: 'VIABILITY_VETO' });
    expect(exclusionDeFila({ exclusionType: 'NO_COLLAR', reason: 'Sin par.' }).etiqueta).toBe('Sin collar líquido');
    expect(exclusionDeFila({ exclusionType: 'INSUFFICIENT_DATA', reason: 'Falta 002.' }).etiqueta).toBe('Datos insuficientes');
    expect(exclusionDeFila({ reason: 'Algo.' }).etiqueta).toBe('Excluida');
  });
});
