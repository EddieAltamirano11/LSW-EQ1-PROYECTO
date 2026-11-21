import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import CoreResultsModal from './CoreResultsModal';
import { screener } from '../services/__fixtures__/screener';

// La API informa el riesgo de eventos UNVERIFIED cuando Webull no entrega una fecha de resultados.
const causa = 'Webull no entregó una fecha de resultados utilizable.';
const sinFecha = structuredClone(screener);
const fundamental = sinFecha.candidates[0].cores['002'];
fundamental.status = 'PARTIAL';
fundamental.result.risk = 'UNVERIFIED';
fundamental.result.event = { risk: 'UNVERIFIED', reason: causa, start: null, end: null };
sinFecha.candidates[0].cores['003'] = {
  status: 'PARTIAL', role: 'CONFLUENCE', score: 65, evidence: [],
  result: { signal: 'HOLD', strength: 0, rule: 'EVENT_UNVERIFIED', risk: 'UNVERIFIED' },
};

describe('earnings sin verificar en la consulta por core', () => {
  afterEach(cleanup);

  it('Fundamental muestra «Earnings sin verificar» con la causa y sin fecha de resultados', () => {
    render(<CoreResultsModal coreId="002" data={sinFecha} onClose={() => {}} />);
    const [fila] = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    expect(within(fila).getByText(/Earnings sin verificar/)).toBeTruthy();
    fireEvent.click(within(fila).getByRole('button', { name: /Ver evidencia de AAPL/ }));
    const dialogo = screen.getByRole('dialog');
    expect(within(dialogo).getAllByText(/Earnings sin verificar/).length).toBeGreaterThan(1);
    expect(within(dialogo).getByText(causa)).toBeTruthy();
    expect(within(dialogo).queryByText(/2027-01-28/)).toBeNull();
  });

  it('Señales directas muestra la abstención por earnings sin verificar', () => {
    render(<CoreResultsModal coreId="003" data={sinFecha} onClose={() => {}} />);
    const [fila] = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    expect(within(fila).getByText(/Earnings sin verificar/)).toBeTruthy();
  });
});
