import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import BrokerExecutionModal from './BrokerExecutionModal';

// Candidato con la forma del escáner (Black-Scholes): sus primas son teóricas, no cotizaciones de mercado.
const candidato = {
  symbol: 'AAPL', spotPrice: 343.4, optimalExpiration: '2027-01-08',
  putFloor: { strike: 325, theoreticalPremium: 3.24, moneyness: '5.4% OTM' },
  callCeiling: { strike: 360, theoreticalPremium: 4.93, moneyness: '4.8% OTM' },
  financialMetrics: { netDebitCredit: 1.69 },
};

describe('primas del escáner rotuladas como teóricas en el modal', () => {
  afterEach(cleanup);

  it('el collar muestra las primas del escáner como teóricas', () => {
    render(<BrokerExecutionModal isOpen onClose={() => {}} modalData={{
      candidate: candidato, broker: 'ALPACA', strategyType: 'COLLAR_SPREAD', ok: false, status: 400, data: { message: 'x' },
    }} />);
    expect(screen.getAllByText(/Prima teórica/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/\$3\.24/)).toBeTruthy();
    expect(screen.getByText(/\$4\.93/)).toBeTruthy();
  });

  it('distingue la prima enviada en la orden de la teórica del escáner', () => {
    render(<BrokerExecutionModal isOpen onClose={() => {}} modalData={{
      candidate: candidato, broker: 'ALPACA', strategyType: 'PROTECTIVE_PUT', ok: false, status: 400, data: { message: 'x' },
      payload: { putStrike: 325, putPremium: 3.5 },
    }} />);
    expect(screen.getAllByText(/Prima enviada/).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/marketPremium/)).toBeNull();
  });
});
