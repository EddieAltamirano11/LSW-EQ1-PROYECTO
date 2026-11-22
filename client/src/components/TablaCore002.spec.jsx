import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import CoreResultsModal from './CoreResultsModal';

const evidencia = [{ source: 'Prueba', observedAt: '2026-11-20T21:00:00Z', reference: 'ref', delayMinutes: 0 }];

function fundamental({ classification, score, status = 'AVAILABLE', role = 'GATE', effectiveWeight, altman, passed, evaluated, risk, reason }) {
  return {
    status, active: role === 'CONFLUENCE', role, ...(Number.isFinite(effectiveWeight) ? { effectiveWeight } : {}),
    ...(Number.isFinite(score) ? { score } : {}), evidence: evidencia,
    result: {
      classification, risk,
      altman: Number.isFinite(altman) ? { value: altman } : null,
      piotroski: { passed, evaluated },
      indicators: { pe: 18.4 }, fiscalYears: ['2026-12-31', '2025-12-31'],
      ...(reason ? { reason } : {}),
    },
  };
}

function datos() {
  return {
    asOf: '2026-11-20T21:00:00.000Z',
    status: 'PARTIAL',
    candidates: [
      {
        rank: 1, symbol: 'AAPL', companyName: 'Apple Inc.', eligibility: 'VIABLE', score: 80,
        cores: { '002': fundamental({ classification: 'VIABLE', score: 70, role: 'CONFLUENCE', effectiveWeight: 0.25, altman: 12.86, passed: 9, evaluated: 9, risk: 'LOW' }) },
      },
      {
        rank: 2, symbol: 'MSFT', companyName: 'Microsoft Corp.', eligibility: 'VIABLE', score: 72,
        cores: { '002': fundamental({ classification: 'VIABLE', score: 95, status: 'PARTIAL', altman: 3.1, passed: 8, evaluated: 9, risk: 'HIGH' }) },
      },
    ],
    excluded: [
      {
        symbol: 'AMZN', companyName: 'Amazon.com Inc.', eligibility: 'MARGINAL', reason: 'Veto de viabilidad MARGINAL.',
        exclusionType: 'VIABILITY_VETO',
        cores: { '002': fundamental({ classification: 'MARGINAL', score: 60, altman: 1.5, passed: 5, evaluated: 9, risk: 'UNVERIFIED', reason: 'Sin fecha de resultados.' }) },
      },
      {
        symbol: 'AMD', companyName: 'Advanced Micro Devices', eligibility: 'UNKNOWN', reason: 'Datos insuficientes.',
        exclusionType: 'INSUFFICIENT_DATA',
        cores: { '002': { status: 'UNAVAILABLE', role: 'GATE', result: null, evidence: [], reason: 'Cobertura contable insuficiente.' } },
      },
    ],
  };
}

const abrir = () => render(<CoreResultsModal coreId="002" data={datos()} onClose={() => {}} />);
const tabla = () => screen.getByRole('table');
const filas = () => within(tabla()).getAllByRole('row')
  .filter(fila => within(fila).queryByRole('button', { name: /Ver evidencia de/ }));
const simbolos = () => filas().map(fila => within(fila).getByRole('button', { name: /Ver evidencia de/ }).getAttribute('aria-label'));

describe('pestaña Tabla del Core 002', () => {
  afterEach(cleanup);

  it('muestra el selector de orden y el badge del ranking global por defecto', () => {
    abrir();
    expect(screen.getByRole('group', { name: 'Ordenar tabla' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ranking Confluencia' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Puntaje Fundamental' }).getAttribute('aria-pressed')).toBe('false');
    const puesto = screen.getByLabelText('Puesto 1 en el ranking global');
    expect(puesto.textContent).toBe('#1');
    expect(puesto.getAttribute('title')).toBe('Puesto en el ranking global de confluencia');
    expect(simbolos()).toEqual([
      'Ver evidencia de AAPL', 'Ver evidencia de MSFT',
      'Ver evidencia de AMD', 'Ver evidencia de AMZN',
    ]);
    expect(screen.getByText('Candidatas en Ranking')).toBeTruthy();
    expect(screen.getByText('Excluidas')).toBeTruthy();
    expect(screen.getByText(/Análisis parcial · Corte/)).toBeTruthy();
    expect(screen.getByText(/4 empresas evaluadas/)).toBeTruthy();
  });

  it('sustituye «excluida» por badges semánticos y atenúa las filas excluidas', () => {
    abrir();
    expect(screen.getByText('Veto GATE')).toBeTruthy();
    expect(screen.getByText('Datos incompletos')).toBeTruthy();
    expect(document.body.textContent).not.toContain('· excluida');
    expect(screen.getByText('Veto GATE').closest('tr').className).toContain('opacity-85');
    expect(screen.getByText('Datos incompletos').closest('tr').className).toContain('opacity-85');
    for (const simbolo of ['AAPL', 'MSFT', 'AMZN', 'AMD']) {
      expect(screen.getByRole('button', { name: `Ver evidencia de ${simbolo}` })).toBeTruthy();
    }
  });

  it('muestra estados, puntaje, participación y chips compactos en lugar de texto concatenado', () => {
    abrir();
    expect(screen.getAllByText('Disponible')).toHaveLength(2);
    expect(screen.getByText('Parcial')).toBeTruthy();
    expect(screen.getByText('70')).toBeTruthy();
    expect(screen.getAllByText('/100')).toHaveLength(3);
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.getByText('Confluencia · 25%')).toBeTruthy();
    expect(screen.getAllByText('Sin ponderación')).toHaveLength(3);

    expect(screen.getAllByText('VIABLE')).toHaveLength(2);
    expect(screen.getByText('MARGINAL')).toBeTruthy();
    expect(screen.getByText('UNKNOWN')).toBeTruthy();
    expect(screen.getByText('Altman: 12.86')).toBeTruthy();
    expect(screen.getByText('Piotroski: 9/9')).toBeTruthy();
    expect(screen.getByText('Altman: N/D')).toBeTruthy();
    expect(screen.getByText('Piotroski: N/D')).toBeTruthy();
    expect(screen.getByText(/Earnings ≤7d/)).toBeTruthy();
    expect(screen.getByText(/Earnings N\/V/)).toBeTruthy();
    expect(document.body.textContent).not.toContain(' · Altman ');
  });

  it('ordena por puntaje fundamental con los guiones al final', () => {
    abrir();
    fireEvent.click(screen.getByRole('button', { name: 'Puntaje Fundamental' }));
    expect(screen.getByRole('button', { name: 'Puntaje Fundamental' }).getAttribute('aria-pressed')).toBe('true');
    expect(simbolos()).toEqual([
      'Ver evidencia de MSFT', 'Ver evidencia de AAPL',
      'Ver evidencia de AMZN', 'Ver evidencia de AMD',
    ]);
    expect(screen.queryByLabelText('Puesto 1 en el ranking global')).toBeNull();
    expect(screen.getByText('Excluidas')).toBeTruthy();
  });

  it('conserva el detalle individual expandible', () => {
    abrir();
    const boton = screen.getByRole('button', { name: 'Ver evidencia de AAPL' });
    expect(boton.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(boton);
    expect(boton.getAttribute('aria-expanded')).toBe('true');
    const detalle = document.getElementById('detalle-002-AAPL');
    expect(detalle).toBeTruthy();
    expect(within(detalle).getByText('12.86')).toBeTruthy();
    fireEvent.click(boton);
    expect(document.getElementById('detalle-002-AAPL')).toBeNull();
  });
});
