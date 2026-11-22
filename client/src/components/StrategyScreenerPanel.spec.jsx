import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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
});
