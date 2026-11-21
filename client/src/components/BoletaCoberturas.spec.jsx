import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { BoletaCollar, BoletaProtectivePut } from './BoletaCoberturas';
import BrokerExecutionModal from './BrokerExecutionModal';
import StrategyScreenerPanel from './StrategyScreenerPanel';

const vista = {
  fuente: 'RANKING', etiqueta: 'Collar', symbol: 'AAPL',
  put: { contractSymbol: 'AAPL261231P00330000', strike: 330, expirationDate: '2026-12-31', ask: 9.2, quoteTime: '2026-11-20T21:00:00.000Z', source: 'Webull' },
  call: { contractSymbol: 'AAPL261231C00360000', strike: 360, expirationDate: '2026-12-31', bid: 5.2, quoteTime: '2026-11-20T21:00:00.000Z', source: 'Webull' },
  costoNeto: { tipo: 'Débito', monto: 4 },
};

describe('boleta de coberturas con datos reales', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('el Auto-Collar muestra el collar del ranking rotulado «Collar» con su costo neto', () => {
    const emitir = vi.fn();
    render(<BoletaCollar estado={{ fase: 'lista', vista }} onEmitir={emitir} />);
    expect(screen.getByText('Collar')).toBeTruthy();
    expect(screen.getByText(/AAPL261231P00330000/)).toBeTruthy();
    expect(screen.getByText(/Débito \$4\.00\/acc/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Emitir a Broker \(LIVE\)/ }));
    expect(emitir).toHaveBeenCalledWith(vista);
  });

  it('el Protective Put muestra el Put real con su ask, instante y fuente', () => {
    const put = { symbol: 'AAPL', contractSymbol: 'AAPL261231P00330000', strike: 330, expirationDate: '2026-12-31', ask: 9.2, quoteTime: '2026-11-20T21:03:14.932Z', source: 'Contratos listados de Alpaca con cotizaciones de Webull OpenAPI' };
    render(<BoletaProtectivePut estado={{ fase: 'lista', vista: put }} onEmitir={() => {}} />);
    expect(screen.getByText(/AAPL261231P00330000/)).toBeTruthy();
    expect(screen.getByText(/\$9\.20/)).toBeTruthy();
    expect(screen.getByText(/2026-11-20T21:03:14/)).toBeTruthy();
    expect(screen.getByText(/Webull OpenAPI/)).toBeTruthy();
  });

  it('sin vista previa explica la causa, deshabilita la emisión y no muestra primas ni probabilidades', () => {
    render(<BoletaCollar estado={{ fase: 'error', causa: 'Sin cadena de opciones real para ZZZZ.' }} onEmitir={() => {}} />);
    expect(screen.getByText(/Sin cadena de opciones real para ZZZZ/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Emitir a Broker/ }).disabled).toBe(true);
    expect(screen.queryByText(/\$\d/)).toBeNull();
    expect(screen.queryByText(/%/)).toBeNull();
  });

  it('el modal destaca PARTIALLY_EXECUTED y el estado de cada orden ante un 409', () => {
    render(<BrokerExecutionModal isOpen onClose={() => {}} modalData={{
      broker: 'ALPACA', strategyType: 'ZERO_COST_COLLAR', status: 409, ok: false,
      data: {
        message: 'Ejecución parcial en ALPACA', strategy: { status: 'PARTIALLY_EXECUTED' },
        orders: [
          { legRole: 'HEDGE_FLOOR', contractSymbol: 'AAPL261231P00330000', side: 'buy', quantity: 1, limitPrice: 9.2, orderId: 'p-1', status: 'filled', filledQty: 1 },
          { legRole: 'UNDERLYING', side: 'buy', quantity: 100, limitPrice: 345, orderId: null, status: null, filledQty: null, brokerMessage: 'rechazo' },
        ],
      },
    }} />);
    expect(screen.getAllByText(/PARTIALLY_EXECUTED/).length).toBeGreaterThan(0);
    expect(screen.getByText('filled')).toBeTruthy();
    expect(screen.getByText(/Ejecutado: 1/)).toBeTruthy();
    expect(screen.queryByText('submitted')).toBeNull();
  });

  it('un error de la consulta de cores se muestra sin reintentar con otros parámetros', async () => {
    const fetchSimulado = vi.fn(async () => new Response(JSON.stringify({ message: 'La solicitud contiene campos no admitidos.' }), { status: 400 }));
    vi.stubGlobal('fetch', fetchSimulado);
    render(<StrategyScreenerPanel apiBase="http://api" token="t" dteHorizon={45} extraSymbols={['ZZZZ']} />);
    fireEvent.click(screen.getByRole('button', { name: /Evaluar Cores/ }));
    expect(await screen.findByText(/campos no admitidos/)).toBeTruthy();
    expect(fetchSimulado).toHaveBeenCalledTimes(1);
  });
});
