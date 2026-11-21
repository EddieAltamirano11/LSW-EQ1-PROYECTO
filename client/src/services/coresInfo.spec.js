import { describe, expect, it } from 'vitest';
import { CORES_INFO, datosClave, empresasEvaluadas, participacion } from './coresInfo';
import { screener } from './__fixtures__/screener';

describe('coresInfo', () => {
  it('describe cómo se calcula cada uno de los siete cores', () => {
    expect(Object.keys(CORES_INFO)).toEqual(['001', '002', '003', '004', '005', '006', '007']);
    for (const info of Object.values(CORES_INFO)) {
      expect(info.nombre).toBeTruthy();
      expect(info.fuentes.length).toBeGreaterThan(0);
      expect(info.ventanas).toBeTruthy();
      expect(info.peso).toBeTruthy();
      expect(info.participa).toBeTruthy();
    }
    expect(CORES_INFO['001'].peso).toContain('30');
    expect(CORES_INFO['004'].peso).toMatch(/no pondera/i);
  });

  it('traduce la participación de cada core', () => {
    expect(participacion('001', { role: 'CONFLUENCE', effectiveWeight: 0.225 })).toBe('Confluencia · 22.5 %');
    expect(participacion('002', { role: 'GATE' })).toMatch(/Filtro de viabilidad.*no entra a la confluencia/);
    expect(participacion('004', { role: 'GATE' })).toMatch(/Filtro de ejecutabilidad/);
    expect(participacion('001', { role: 'DEPENDENCY' })).toMatch(/dependencia.*no entra a la confluencia/);
    expect(participacion('007', { role: 'SYNTHESIS' })).toMatch(/Síntesis/);
    expect(participacion('005', { role: 'NOT_COMPUTED' })).toBe('No calculado');
    expect(participacion('001', {})).toMatch(/Sin dato de participación/);
  });

  it('resume los datos clave o el motivo cuando no hay resultado', () => {
    const [aapl, xyz] = empresasEvaluadas(screener);
    expect(aapl.symbol).toBe('AAPL');
    expect(xyz.symbol).toBe('XYZ');
    expect(datosClave('001', aapl.cores['001'])).toBe('Alcista · RSI 58.2 · ADX 27.4');
    expect(datosClave('004', aapl.cores['004'])).toContain('Put 220 / Call 240');
    expect(datosClave('004', xyz.cores['004'])).toBe('Veto de viabilidad MARGINAL.');
    expect(datosClave('005', aapl.cores['005'])).toBe('Sin seleccionar');
  });
});
