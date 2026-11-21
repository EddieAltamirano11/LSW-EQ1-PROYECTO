import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import CoreResultsModal from './CoreResultsModal';
import { screener } from '../services/__fixtures__/screener';
import { serieTecnica } from '../services/__fixtures__/serieTecnica';

// La gráfica técnica usa canvas, que jsdom no implementa; aquí se prueba la pestaña y sus estados.
vi.mock('./GraficaTecnica', () => ({ default: () => <div data-testid="grafica-tecnica" /> }));

const abrir = coreId => render(
  <CoreResultsModal coreId={coreId} data={screener} apiBase="http://api" token="t" onClose={() => {}} />,
);
const pestanaGrafica = () => fireEvent.click(screen.getByRole('tab', { name: 'Gráfica' }));

describe('pestaña Gráfica de la consulta por core', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('solo existe para Técnico, Estrategia y Confluencia, y después de evaluar', () => {
    abrir('002');
    expect(screen.queryByRole('tab', { name: 'Gráfica' })).toBeNull();
    cleanup();
    render(<CoreResultsModal coreId="004" onClose={() => {}} />);
    expect(screen.queryByRole('tab', { name: 'Gráfica' })).toBeNull();
  });

  it('Estrategia dibuja el payoff del collar de la empresa elegida y muestra la causa si no tiene collar', async () => {
    abrir('004');
    pestanaGrafica();
    const grafica = await screen.findByRole('img', { name: /Payoff del collar de AAPL/ });
    expect(grafica.tagName.toLowerCase()).toBe('svg');
    expect(screen.getByText(/Put 220 y Call 240/)).toBeTruthy();
    expect(screen.getByText(/1,120.00/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Empresa'), { target: { value: 'XYZ' } });
    expect(await screen.findByText('Veto de viabilidad MARGINAL.')).toBeTruthy();
    expect(screen.queryByRole('img', { name: /Payoff/ })).toBeNull();
  });

  it('Confluencia muestra la contribución de cada core', async () => {
    abrir('007');
    pestanaGrafica();
    const grafica = await screen.findByRole('img', { name: /Contribución por core de AAPL/ });
    expect(within(grafica).getAllByTestId('barra-contribucion')).toHaveLength(1);
    expect(screen.getByText(/Puntaje de confluencia 75/)).toBeTruthy();
  });

  it('Técnico reutiliza la gráfica técnica con la serie de la empresa elegida', async () => {
    const fetchSimulado = vi.fn(async () => new Response(JSON.stringify(serieTecnica), { status: 200 }));
    vi.stubGlobal('fetch', fetchSimulado);
    abrir('001');
    pestanaGrafica();
    expect(await screen.findByTestId('grafica-tecnica')).toBeTruthy();
    expect(fetchSimulado.mock.calls[0][0]).toBe('http://api/api/v2/strategy-screener/technical/AAPL');
    expect(screen.queryByRole('button', { name: 'Volver a TradingView' })).toBeNull();
  });
});
