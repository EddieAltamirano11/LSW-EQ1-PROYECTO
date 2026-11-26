import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import CoreResultsModal from './CoreResultsModal';
import DetalleFundamental002 from './DetalleFundamental002';

const evidencia = [
  { source: 'SEC EDGAR', observedAt: '2026-11-20T21:00:00Z', reference: 'CIK 0000320193 · ejercicio al 2026-09-26', delayMinutes: 0 },
  { source: 'Alpaca Market Data IEX', observedAt: '2026-11-20T20:59:00Z', reference: 'AAPL · cierre de 1 minuto', delayMinutes: 15 },
  { source: 'Webull OpenAPI · Financial Alerts', observedAt: '2026-11-20T20:58:00Z', reference: 'AAPL · 2027-01-25 a 2027-01-29', delayMinutes: 0 },
];

// Mismas claves y orden que `fScore` en src/api/v2/services/strategyScreener/fundamentalCore.js.
const pruebas = {
  positiveRoa: true,
  positiveCashFlow: true,
  improvedRoa: true,
  operatingCashAboveIncome: true,
  reducedLongDebt: false,
  improvedCurrentRatio: false,
  nonDilutionProxy: false,
  improvedGrossMargin: false,
  improvedTurnover: null,
};

function resultado() {
  return {
    classification: 'VIABLE', valuation: 'OVERVALUED', risk: 'HIGH', cik: '0000320193',
    event: { risk: 'HIGH', start: '2027-01-27', end: '2027-01-29', estimated: true },
    altman: { value: 12.86, lower: 1.81, upper: 2.99, variant: 'Z · manufactura pública' },
    piotroski: { passed: 4, evaluated: 8, tests: pruebas },
    indicators: { pe: 38.24 }, fiscalYears: ['2026-09-26', '2025-09-27'],
  };
}

function abrirDetalle() {
  render(<CoreResultsModal coreId="002" data={{
    asOf: '2026-11-20T21:00:00.000Z', status: 'COMPLETE',
    candidates: [{
      rank: 1, symbol: 'AAPL', companyName: 'Apple Inc.', eligibility: 'VIABLE', score: 80,
      cores: { '002': { status: 'AVAILABLE', role: 'GATE', score: 70, evidence: evidencia, result: resultado() } },
    }],
    excluded: [],
  }} onClose={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'Ver evidencia de AAPL' }));
  return document.getElementById('detalle-002-AAPL');
}

describe('detalle individual del Core 002', () => {
  afterEach(cleanup);

  it('muestra ocho KPI cards con badges, semáforo de Altman y barra de Piotroski', () => {
    const detalle = abrirDetalle();
    const cuadricula = detalle.querySelector('.grid');
    expect(cuadricula.className).toContain('grid-cols-2');
    expect(cuadricula.className).toContain('md:grid-cols-4');
    expect(cuadricula.className).toContain('gap-3');
    expect(cuadricula.children).toHaveLength(8);
    expect(cuadricula.firstElementChild.className).toContain('border-slate-200/70');

    expect(within(detalle).getByText('Viabilidad')).toBeTruthy();
    expect(within(detalle).getByText('Valuación')).toBeTruthy();
    expect(within(detalle).getByText('OVERVALUED')).toBeTruthy();
    expect(within(detalle).getByText('HIGH')).toBeTruthy();
    expect(within(detalle).getByText('2027-01-27')).toBeTruthy();
    expect(within(detalle).getByText('Ventana Webull · estimada')).toBeTruthy();
    expect(within(detalle).getByText('12.86')).toBeTruthy();
    expect(within(detalle).getByText('Zona Segura')).toBeTruthy();
    expect(within(detalle).getByText('Z · manufactura pública · umbrales 1.81 / 2.99')).toBeTruthy();
    expect(within(detalle).getByText('38.24')).toBeTruthy();
    expect(within(detalle).getByText('Múltiplo actual')).toBeTruthy();
    expect(within(detalle).getByText('2026-09-26')).toBeTruthy();
    expect(within(detalle).getByText('2025-09-27')).toBeTruthy();

    const barra = within(detalle).getByRole('img', { name: /Pruebas Piotroski: 4 de 8 evaluables aprobadas/ });
    expect(barra.querySelectorAll('[data-criterio]')).toHaveLength(9);
    expect(barra.querySelectorAll('.bg-emerald-500')).toHaveLength(4);
    expect(barra.querySelectorAll('.bg-slate-600')).toHaveLength(4);
    expect(barra.querySelectorAll('.border-dashed')).toHaveLength(1);
    expect(within(barra).queryAllByTitle(/Prueba \d+/)).toHaveLength(0);
  });

  it('nombra los nueve criterios y su resultado en tooltips propios, sin title nativo', () => {
    const detalle = abrirDetalle();
    const barra = within(detalle).getByRole('img', { name: /Pruebas Piotroski/ });
    const esperado = [
      ['positiveRoa', '1. ROA positivo', 'Rentabilidad neta positiva sobre activos', '✓ Aprobada', 'Aprobada'],
      ['positiveCashFlow', '2. Flujo operativo positivo', 'Generación de efectivo operativa positiva', '✓ Aprobada', 'Aprobada'],
      ['improvedRoa', '3. Mejora del ROA', 'Mayor retorno sobre activos respecto al año anterior', '✓ Aprobada', 'Aprobada'],
      ['operatingCashAboveIncome', '4. Calidad de ganancias', 'Flujo operativo superior a la utilidad neta', '✓ Aprobada', 'Aprobada'],
      ['reducedLongDebt', '5. Menor deuda a largo plazo', 'Reducción del apalancamiento financiero', '✕ Reprobada', 'Reprobada'],
      ['improvedCurrentRatio', '6. Mejor liquidez (Razón corriente)', 'Mayor capacidad de cubrir pasivos a corto plazo', '✕ Reprobada', 'Reprobada'],
      ['nonDilutionProxy', '7. Sin dilución de acciones', 'No emitió nuevas acciones en el último año', '✕ Reprobada', 'Reprobada'],
      ['improvedGrossMargin', '8. Mejor margen bruto', 'Mayor rentabilidad bruta respecto al periodo anterior', '✕ Reprobada', 'Reprobada'],
      ['improvedTurnover', '9. Mayor rotación de activos', 'Más eficiencia generando ventas con sus activos', '— Sin datos', 'Sin datos'],
    ];

    esperado.forEach(([clave, titulo, descripcion, estado, etiqueta]) => {
      const segmento = barra.querySelector(`[data-criterio="${clave}"]`);
      expect(segmento).toBeTruthy();
      expect(segmento.getAttribute('aria-label')).toBe(`${titulo}: ${etiqueta}`);
      expect(segmento.querySelector('[title]')).toBeNull();
      const tooltip = within(segmento).getByRole('tooltip');
      expect(tooltip.textContent).toContain(titulo);
      expect(tooltip.textContent).toContain(descripcion);
      expect(tooltip.textContent).toContain(estado);
      expect(tooltip.className).toContain('opacity-0');
      expect(tooltip.className).toContain('group-hover:opacity-100');
      const barraSegmento = segmento.firstElementChild;
      expect(barraSegmento.className).toContain('cursor-help');
      expect(barraSegmento.className).toContain('group-hover:scale-y-125');
      expect(barraSegmento.className).toContain('transition-transform');
    });
  });

  it('explica cada KPI card con un tooltip general al enfocar o pasar el cursor', () => {
    const detalle = abrirDetalle();
    const esperado = [
      ['Viabilidad', 'Indica si la empresa reúne condiciones financieras suficientes para seguir en el análisis.', 'izquierda'],
      ['Valuación', 'Da una idea de si la acción se ve cara, razonable o barata comparado con lo que la empresa gana y vende.', 'derecha'],
      ['Riesgo de evento', 'Muestra cuánta incertidumbre hay por la proximidad de los próximos resultados.', 'izquierda'],
      ['Próximos resultados', 'Fecha o ventana estimada en la que la empresa publicará sus resultados. Si no hay dato, no se inventa.', 'derecha'],
      ['Altman Z-Score', 'Indicador de salud financiera: ayuda a distinguir entre una empresa sólida, una en zona de alerta y una con riesgo financiero.', 'izquierda'],
      ['Piotroski F-Score', 'Resume cuántas señales positivas mostró la empresa en sus cuentas del último año. Solo es fiable si hay información suficiente.', 'derecha'],
      ['Ratio P/E', 'Compara el precio de la acción con lo que gana la empresa por acción. Ayuda a juzgar si está cara o barata.', 'izquierda'],
      ['Ejercicios fiscales', 'Los dos años de cuentas que se usaron para calcular los indicadores de la empresa.', 'derecha'],
    ];

    esperado.forEach(([titulo, descripcion, alineacion]) => {
      const etiqueta = within(detalle).getByText(titulo);
      expect(etiqueta.getAttribute('tabindex')).toBe('0');
      expect(etiqueta.querySelector('[title]')).toBeNull();
      expect(etiqueta.parentElement.className).toContain('cursor-help');
      const tooltip = document.getElementById(etiqueta.getAttribute('aria-describedby'));
      expect(tooltip).toBeTruthy();
      expect(tooltip.getAttribute('role')).toBe('tooltip');
      expect(tooltip.textContent).toBe(descripcion);
      expect(tooltip.className).toContain('opacity-0');
      expect(tooltip.className).toContain('group-hover:opacity-100');
      expect(tooltip.className).toContain('group-focus-within:opacity-100');
      expect(tooltip.className).toContain(alineacion === 'derecha' ? 'right-0' : 'left-0');
    });
  });

  it('deja la trazabilidad plegada y revela CIK, timestamps y ventanas al expandirla', () => {
    const detalle = abrirDetalle();
    const acordeon = within(detalle).getByRole('button', { name: /Ver trazabilidad/ });
    expect(acordeon.getAttribute('aria-expanded')).toBe('false');
    expect(within(detalle).queryByText('CIK · 0000320193')).toBeNull();
    expect(within(detalle).queryByText('sin trazabilidad')).toBeNull();

    fireEvent.click(acordeon);
    expect(acordeon.getAttribute('aria-expanded')).toBe('true');
    const trazabilidad = document.getElementById(acordeon.getAttribute('aria-controls'));
    expect(trazabilidad.querySelector('ul').className).toContain('font-mono');
    expect(trazabilidad.textContent).toContain('SEC EDGAR · CIK 0000320193 · ejercicio al 2026-09-26 · 2026-11-20T21:00:00Z');
    expect(trazabilidad.textContent).toContain('Alpaca Market Data IEX · AAPL · cierre de 1 minuto · 2026-11-20T20:59:00Z · retraso 15 min');
    expect(trazabilidad.textContent).toContain('CIK · 0000320193');
    expect(trazabilidad.textContent).toContain('Ventana de resultados · 2027-01-27 → 2027-01-29');
    expect(within(detalle).getByText('Fuentes de datos: SEC EDGAR · Alpaca IEX · Webull')).toBeTruthy();
  });

  it('amplía el modal del 002 y mantiene fijas pestañas y controles', () => {
    abrirDetalle();
    const dialogo = screen.getByRole('dialog');
    expect(dialogo.className).toContain('w-[95vw]');
    expect(dialogo.className).toContain('max-w-6xl');
    expect(dialogo.className).toContain('!max-h-[90vh]');
    expect(screen.getByRole('tabpanel').className).toContain('ui-dialog-body');
    expect(screen.getByRole('tab', { name: 'Tabla' }).className).toContain('!min-h-8');
  });

  it('muestra la causa de earnings sin verificar sin inventar una fecha', () => {
    render(<DetalleFundamental002 diagnostic={{
      reason: 'Earnings sin verificar: Webull no entregó una fecha utilizable.',
      result: {
        ...resultado(), risk: 'UNVERIFIED', event: { risk: 'UNVERIFIED', reason: 'Webull no entregó una fecha utilizable.', start: null, end: null },
      },
      evidence: [],
    }} />);
    expect(screen.getByText('Earnings sin verificar')).toBeTruthy();
    expect(screen.getByText('Webull no entregó una fecha utilizable.')).toBeTruthy();
    expect(screen.getByText('Sin fecha')).toBeTruthy();
    expect(screen.queryByText('2027-01-27')).toBeNull();
  });

  it('ubica la zona de Altman con los umbrales informados y deja huecos grises sin pruebas', () => {
    const { rerender } = render(<DetalleFundamental002 diagnostic={{ result: {
      ...resultado(), altman: { value: 0.9, lower: 1.1, upper: 2.6 },
      piotroski: { passed: 4, evaluated: 8 },
    }, evidence: [] }} />);
    expect(screen.getByText('Zona Quiebra')).toBeTruthy();
    const barra = screen.getByRole('img', { name: /Piotroski/ });
    expect(barra.querySelectorAll('.border-dashed')).toHaveLength(1);

    rerender(<DetalleFundamental002 diagnostic={{ result: {
      ...resultado(), altman: { value: 2.0, lower: 1.81, upper: 2.99 },
      piotroski: { passed: 4, evaluated: 8 },
    }, evidence: [] }} />);
    expect(screen.getByText('Zona Gris')).toBeTruthy();

    rerender(<DetalleFundamental002 diagnostic={{ result: {
      ...resultado(), altman: null, piotroski: { passed: 4, evaluated: 8 },
    }, evidence: [] }} />);
    expect(screen.getByText('Sin datos')).toBeTruthy();
  });
});
