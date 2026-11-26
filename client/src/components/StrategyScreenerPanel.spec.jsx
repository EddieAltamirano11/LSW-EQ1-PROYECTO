import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import StrategyScreenerPanel from './StrategyScreenerPanel';
import { screener } from '../services/__fixtures__/screener';

const props = { apiBase: 'http://api', token: 't', dteHorizon: 45 };
const respuesta = (cuerpo, status = 200) => new Response(JSON.stringify(cuerpo), { status });
const casilla = nombre => screen.getByRole('checkbox', { name: new RegExp(nombre) });
const ojo = nombre => screen.getByRole('button', { name: `Ver resultados de ${nombre}` });
const evaluar = () => fireEvent.click(screen.getByRole('button', { name: /Evaluar Cores/ }));

describe('consulta de resultados por core', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('sin evaluar muestra solo cómo se calcula y el botón no cambia la selección', () => {
    render(<StrategyScreenerPanel {...props} />);
    fireEvent.click(casilla('Institucional'));
    expect(casilla('Institucional').checked).toBe(false);
    fireEvent.click(ojo('Institucional'));
    const dialogo = screen.getByRole('dialog', { name: /005 · Institucional/ });
    expect(within(dialogo).getByText(/Evalúa los cores para ver resultados/)).toBeTruthy();
    expect(within(dialogo).getByText(/Fuentes/)).toBeTruthy();
    expect(within(dialogo).queryByRole('table')).toBeNull();
    expect(casilla('Institucional').checked).toBe(false);
    expect(casilla('Técnico').checked).toBe(true);
  });

  it('ofrece el botón también para Estrategia y Confluencia, que no tienen checkbox', () => {
    render(<StrategyScreenerPanel {...props} />);
    expect(ojo('Estrategia de opciones')).toBeTruthy();
    expect(ojo('Confluencia')).toBeTruthy();
    expect(screen.queryByRole('checkbox', { name: /Estrategia|Confluencia/ })).toBeNull();
  });

  it('mientras evalúa indica que está cargando', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    render(<StrategyScreenerPanel {...props} />);
    evaluar();
    await screen.findByText(/Evaluando Cores en Vivo/);
    fireEvent.click(ojo('Técnico'));
    expect(within(screen.getByRole('dialog')).getByRole('status').textContent).toMatch(/Evaluando/);
  });

  it('si la evaluación falla muestra la causa en la consulta', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respuesta({ message: 'Datos reales insuficientes. Calendario bursátil incompleto.' }, 503)));
    render(<StrategyScreenerPanel {...props} />);
    evaluar();
    await screen.findByRole('button', { name: /Reintentar/ });
    fireEvent.click(ojo('Técnico'));
    expect(within(screen.getByRole('dialog')).getByText(/Calendario bursátil incompleto/)).toBeTruthy();
  });

  it('con datos lista una fila por empresa con participación y evidencia, y se cierra con Esc', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respuesta(screener)));
    render(<StrategyScreenerPanel {...props} />);
    evaluar();
    await screen.findByRole('button', { name: /Evaluar Cores Cuantitativos/ });
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
    await screen.findByText(/Análisis completo/);

    fireEvent.click(ojo('Técnico'));
    const dialogo = screen.getByRole('dialog');
    const filas = within(dialogo).getAllByRole('row').slice(1);
    expect(filas.map(fila => within(fila).getAllByRole('cell')[0].textContent)).toEqual(['1. AAPLApple Inc.', 'XYZXYZ Corp. · excluida']);
    expect(within(filas[0]).getByText('Confluencia · 22.5 %')).toBeTruthy();
    expect(within(filas[0]).getByText('Alcista · RSI 58.2 · ADX 27.4')).toBeTruthy();
    fireEvent.click(within(filas[0]).getByRole('button', { name: /Ver evidencia de AAPL/ }));
    expect(within(dialogo).getByText(/Fuente de prueba/)).toBeTruthy();

    fireEvent.click(within(dialogo).getByRole('tab', { name: 'Cómo se calcula' }));
    expect(within(dialogo).getByText(/Alpaca Market Data IEX/)).toBeTruthy();

    fireEvent.keyDown(dialogo, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(ojo('Técnico'));

    fireEvent.click(ojo('Fundamental'));
    expect(within(screen.getByRole('dialog')).getAllByText('Sin ponderación').length).toBe(2);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    fireEvent.click(ojo('Estrategia de opciones'));
    const collar = within(screen.getByRole('dialog'));
    expect(collar.getByText(/Put 220 \/ Call 240/)).toBeTruthy();
    expect(collar.getAllByText('Veto de viabilidad MARGINAL.').length).toBeGreaterThan(0);
  });

  it('consulta IA solo por acción explícita y muestra motivos, riesgos y fuentes fechadas', async () => {
    const result = { asOf: '2026-11-12T20:00:00Z', model: 'gemini-3.1-flash-lite', recommendations: [{
      symbol: 'AAPL', verdict: 'CONSIDER',
      reasons: [{ text: 'Viabilidad favorable.', evidenceId: 'AAPL/fundamental' }],
      risks: [{ text: 'La valoración puede reducir el atractivo.', evidenceId: 'AAPL/fundamental' }],
      evidence: [{ id: 'AAPL/fundamental', label: 'Viabilidad', detail: 'Clasificación VIABLE', status: 'AVAILABLE',
        sources: [{ source: 'SEC EDGAR', observedAt: '2026-09-30', reference: null }] }],
    }] };
    const request = vi.fn(async () => respuesta(result));
    vi.stubGlobal('fetch', request);
    render(<StrategyScreenerPanel {...props} selectedSymbol="AAPL" />);
    fireEvent.click(casilla('Institucional'));
    expect(request).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Analizar AAPL' }));
    const [url, options] = request.mock.calls[0];
    expect(url).toBe('http://api/api/v2/strategy-screener/ai-analysis');
    expect(JSON.parse(options.body)).toEqual({
      scope: 'SYMBOL', symbol: 'AAPL', dteHorizon: 45, activeCores: ['001', '002', '003', '006'],
    });
    expect(await screen.findByText(/AAPL · Sí/)).toBeTruthy();
    expect(screen.getByText(/Modelo gemini-3.1-flash-lite/)).toBeTruthy();
    expect(screen.getByText('Viabilidad favorable.')).toBeTruthy();
    expect(screen.getByText('La valoración puede reducir el atractivo.')).toBeTruthy();
    expect(screen.getAllByText(/SEC EDGAR/).some(element => element.closest('details')?.textContent.includes('2026-09-30'))).toBe(true);
  });

  it('descarta respuestas de un ticker anterior y permite solicitar sugerencias', async () => {
    let resolveFirst;
    const request = vi.fn()
      .mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve; }))
      .mockResolvedValueOnce(respuesta({ asOf: '2026-11-12T20:00:00Z', recommendations: [], message: 'Sin sugerencias.' }));
    vi.stubGlobal('fetch', request);
    const { rerender } = render(<StrategyScreenerPanel {...props} selectedSymbol="AAPL" />);
    fireEvent.click(screen.getByRole('button', { name: 'Analizar AAPL' }));
    const signal = request.mock.calls[0][1].signal;
    rerender(<StrategyScreenerPanel {...props} selectedSymbol="MSFT" />);
    expect(signal.aborted).toBe(true);
    await act(async () => resolveFirst(respuesta({ message: 'Respuesta anterior' }, 503)));
    expect(screen.queryByText('Respuesta anterior')).toBeNull();
    expect(screen.getByRole('button', { name: 'Analizar MSFT' }).disabled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Sugerir empresas' }));
    expect(JSON.parse(request.mock.calls[1][1].body)).toMatchObject({ scope: 'CANDIDATES', extraSymbols: [] });
    expect(await screen.findByText('Sin sugerencias.')).toBeTruthy();
    rerender(<StrategyScreenerPanel {...props} dteHorizon={30} selectedSymbol="MSFT" />);
    expect(screen.queryByText('Sin sugerencias.')).toBeNull();
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('destaca a la primera candidata y explica por qué una opción podría no convenir cuando hay un riesgo', async () => {
    const recommendations = [
      { symbol: 'MSFT', verdict: 'CONSIDER', reasons: [{ text: 'La protección cuesta poco.' }], risks: [], evidence: [] },
      { symbol: 'AAPL', verdict: 'CONSIDER', reasons: [{ text: 'El collar ofrece un buen margen de protección.' }],
        risks: [{ text: 'El próximo reporte podría mover el precio.' }], evidence: [] },
    ];
    const request = vi.fn(async () => respuesta({ scope: 'CANDIDATES', asOf: '2026-11-12T20:00:00Z', recommendations }));
    vi.stubGlobal('fetch', request);
    render(<StrategyScreenerPanel {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sugerir empresas' }));
    expect(await screen.findByText('Mejores candidatas')).toBeTruthy();
    const [first, second] = within(screen.getByRole('region', { name: 'Core de IA' })).getAllByRole('article');
    expect(within(first).getByRole('heading').textContent).toBe('MSFT · La que mejor califica');
    expect(within(first).getByText('La protección cuesta poco.')).toBeTruthy();
    expect(within(first).queryByText('Por qué podría no convenir')).toBeNull();
    expect(within(second).getByRole('heading').textContent).toBe('AAPL');
    expect(within(second).getByText('Por qué podría no convenir')).toBeTruthy();
    expect(within(second).getByText('El próximo reporte podría mover el precio.')).toBeTruthy();
  });

  it('mantiene los resultados de los cores si falla la consulta de IA', async () => {
    const request = vi.fn(async url => url.endsWith('/run') ? respuesta(screener)
      : respuesta({ message: 'OpenAI no disponible.' }, 503));
    const onScreenerResults = vi.fn();
    const onEvaluatingError = vi.fn();
    vi.stubGlobal('fetch', request);
    render(<StrategyScreenerPanel {...props} onScreenerResults={onScreenerResults} onEvaluatingError={onEvaluatingError} />);
    evaluar();
    await screen.findByText(/Análisis completo/);
    onEvaluatingError.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Sugerir empresas' }));
    expect((await screen.findByRole('alert')).textContent).toBe('OpenAI no disponible.');
    expect(screen.getByText(/Análisis completo/)).toBeTruthy();
    expect(onScreenerResults).toHaveBeenCalledTimes(1);
    expect(onEvaluatingError).not.toHaveBeenCalled();
  });
});
