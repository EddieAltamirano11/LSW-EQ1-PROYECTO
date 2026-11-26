import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import TradingViewWidget from './TradingViewWidget';
import { serieTecnica } from '../services/__fixtures__/serieTecnica';
import { screener } from '../services/__fixtures__/screener';

// La gráfica usa canvas, que jsdom no implementa; aquí se prueba el selector y los estados, no el dibujo.
vi.mock('./GraficaTecnica', () => ({
  default: ({ serie, spot, cores }) => (
    <div data-testid="grafica-tecnica" data-symbol={serie.symbol} data-spot={spot} data-collar={cores?.['004']?.result?.call?.strike} />
  ),
}));

const props = { symbol: 'NASDAQ:AAPL', ticker: 'AAPL', companyName: 'Apple Inc.', apiBase: 'http://api', token: 't' };
const respuesta = (cuerpo, status = 200) => new Response(JSON.stringify(cuerpo), { status });

describe('TradingViewWidget', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('muestra TradingView por defecto sin pedir la serie técnica', () => {
    const fetchSimulado = vi.fn();
    vi.stubGlobal('fetch', fetchSimulado);
    render(<TradingViewWidget {...props} />);
    expect(screen.getByRole('button', { name: 'TradingView' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Core técnico' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByTitle(/TradingView - NASDAQ:AAPL/)).toBeTruthy();
    expect(fetchSimulado).not.toHaveBeenCalled();
  });

  it('cambia a la vista Core técnico y la sincroniza con el activo seleccionado', async () => {
    const fetchSimulado = vi.fn(async url => respuesta({ ...serieTecnica, symbol: url.split('/').at(-1) }));
    vi.stubGlobal('fetch', fetchSimulado);
    const { rerender } = render(<TradingViewWidget {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Core técnico' }));
    expect(await screen.findByTestId('grafica-tecnica')).toBeTruthy();
    expect(screen.getByText(/AAPL: 3 velas diarias/)).toBeTruthy();
    expect(screen.queryByTitle(/TradingView - NASDAQ:AAPL/)).toBeNull();
    expect(fetchSimulado.mock.calls[0][0]).toBe('http://api/api/v2/strategy-screener/technical/AAPL');

    rerender(<TradingViewWidget {...props} symbol="NASDAQ:MSFT" ticker="MSFT" companyName="Microsoft" />);
    expect(await screen.findByText(/MSFT: 3 velas diarias/)).toBeTruthy();
    expect(fetchSimulado.mock.calls.at(-1)[0]).toBe('http://api/api/v2/strategy-screener/technical/MSFT');
  });

  it('muestra la causa cuando el Core 001 no tiene datos y permite volver a TradingView', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respuesta({ message: 'Datos reales insuficientes. Serie 1Day incompleta o fuera de vigencia para AAPL.' }, 503)));
    render(<TradingViewWidget {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Core técnico' }));
    expect(await screen.findByText(/Serie 1Day incompleta o fuera de vigencia para AAPL/)).toBeTruthy();
    expect(screen.queryByTestId('grafica-tecnica')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Volver a TradingView' }));
    expect(screen.getByTitle(/TradingView - NASDAQ:AAPL/)).toBeTruthy();
  });

  it('actualiza spot y collar sin recargar velas y evita mezclar símbolos durante la carga', async () => {
    let respuestaMsft;
    const fetchSimulado = vi.fn(url => url.endsWith('/MSFT')
      ? new Promise(resolve => { respuestaMsft = resolve; })
      : Promise.resolve(respuesta(serieTecnica)));
    vi.stubGlobal('fetch', fetchSimulado);
    const { rerender } = render(<TradingViewWidget {...props} spot={231} />);
    fireEvent.click(screen.getByRole('button', { name: 'Core técnico' }));
    const grafica = await screen.findByTestId('grafica-tecnica');
    expect(grafica.getAttribute('data-spot')).toBe('231');
    rerender(<TradingViewWidget {...props} spot={232} cores={screener.candidates[0].cores} />);
    expect(grafica.getAttribute('data-spot')).toBe('232');
    expect(grafica.getAttribute('data-collar')).toBe('240');
    expect(fetchSimulado).toHaveBeenCalledTimes(1);

    rerender(<TradingViewWidget {...props} symbol="NASDAQ:MSFT" ticker="MSFT" spot={489.99} />);
    expect(screen.queryByTestId('grafica-tecnica')).toBeNull();
    respuestaMsft(respuesta({ ...serieTecnica, symbol: 'MSFT' }));
    const graficaMsft = await screen.findByTestId('grafica-tecnica');
    expect(graficaMsft.getAttribute('data-symbol')).toBe('MSFT');
    expect(graficaMsft.getAttribute('data-spot')).toBe('489.99');
    expect(graficaMsft.getAttribute('data-collar')).toBeNull();
  });

  it('conserva la vista elegida durante la sesión', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respuesta(serieTecnica)));
    render(<TradingViewWidget {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Core técnico' }));
    await screen.findByTestId('grafica-tecnica');
    cleanup();
    render(<TradingViewWidget {...props} />);
    expect(screen.getByRole('button', { name: 'Core técnico' }).getAttribute('aria-pressed')).toBe('true');
  });
});
