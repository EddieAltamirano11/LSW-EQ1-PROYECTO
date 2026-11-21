import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  avisoExito, collarDelRanking, enviarUnaVez, payloadAutoCollar, payloadProtectivePut, vistaDesdePreviewBackend,
} from './vistaPreviaCobertura';
import { filaCores } from './__fixtures__/ranking';

describe('vista previa de coberturas', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('toma el collar del Core 004 del ranking, rotulado Collar con su costo neto', () => {
    const vista = collarDelRanking({ candidates: [filaCores], excluded: [] }, 'AAPL');
    expect(vista.fuente).toBe('RANKING');
    expect(vista.etiqueta).toBe('Collar');
    expect([vista.put.strike, vista.put.ask, vista.call.strike, vista.call.bid]).toEqual([330, 9.2, 360, 5.2]);
    expect(vista.costoNeto).toEqual({ tipo: 'Débito', monto: 4 });
    expect(collarDelRanking({ candidates: [], excluded: [] }, 'AAPL')).toBeNull();
  });

  it('usa la vista previa del backend cuando el activo no tiene collar en el ranking', () => {
    const vista = vistaDesdePreviewBackend({ preview: {
      symbol: 'SPY', underlying: { price: 690 },
      put: { contractSymbol: 'SPY261231P00655000', strike: 655, expirationDate: '2026-12-31', ask: 7.1, bid: 6.9, quoteTime: '2026-11-20T21:00:00.000Z', source: 'Webull' },
      call: { contractSymbol: 'SPY261231C00725000', strike: 725, expirationDate: '2026-12-31', ask: 3.2, bid: 3, quoteTime: '2026-11-20T21:00:00.000Z', source: 'Webull' },
      metrics: { netPremiumPerShare: 4.1 },
    } });
    expect(vista.fuente).toBe('BACKEND');
    expect(vista.put.contractSymbol).toBe('SPY261231P00655000');
    expect(vista.costoNeto).toEqual({ tipo: 'Débito', monto: 4.1 });
  });

  it('envía los contratos de la vista previa y no primas ni spot del cliente', () => {
    const vista = collarDelRanking({ candidates: [filaCores], excluded: [] }, 'AAPL');
    expect(payloadAutoCollar(vista, { broker: 'WEBULL' })).toEqual({
      symbol: 'AAPL', sharesCount: 100, broker: 'WEBULL', executeOrders: true, autoPersist: true,
      putContractSymbol: vista.put.contractSymbol, callContractSymbol: vista.call.contractSymbol,
    });
    const put = { symbol: 'AAPL', contractSymbol: 'AAPL261231P00330000', strike: 330, ask: 9.2 };
    const payload = payloadProtectivePut(put, { broker: 'ALPACA', sharesCount: 100, buyUnderlying: true });
    expect(payload).toEqual({ symbol: 'AAPL', contractSymbol: 'AAPL261231P00330000', sharesCount: 100, broker: 'ALPACA', executeOrders: true, buyUnderlying: true });
    expect('putPremium' in payload || 'spotPrice' in payload).toBe(false);
  });

  it('arma el aviso de éxito con las órdenes y los strikes de la respuesta', () => {
    const texto = avisoExito('COLLAR', { orders: [
      { legRole: 'HEDGE_FLOOR', strike: 330 }, { legRole: 'COVERED_STOCK', strike: 360 },
    ] }, 'WEBULL', 'AAPL');
    expect(texto).toContain('2 órdenes');
    expect(texto).toContain('Put $330');
    expect(texto).toContain('Call $360');
  });

  it('envía una sola vez y, ante un error de red, informa que el resultado es desconocido', async () => {
    const fetchSimulado = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
    vi.stubGlobal('fetch', fetchSimulado);
    const resultado = await enviarUnaVez('http://api/api/v2/hedging/auto-collar', { method: 'POST' });
    expect(fetchSimulado).toHaveBeenCalledTimes(1);
    expect(resultado.red).toBe(true);
    expect(resultado.mensaje).toMatch(/Revisa las órdenes en el broker/);
  });
});
