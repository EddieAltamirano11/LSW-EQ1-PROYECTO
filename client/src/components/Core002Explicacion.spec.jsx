import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import CoreResultsModal from './CoreResultsModal';
import { CORES_INFO } from '../services/coresInfo';

const ayuda = () => screen.getByRole('button', { name: 'Qué significa seleccionar el Core 002' });
const panel = () => screen.queryByRole('note', { name: 'Qué significa seleccionar el Core 002' });
const abrir = (coreId = '002', onClose = () => {}) => render(
  <CoreResultsModal coreId={coreId} onClose={onClose} />,
);

describe('explicación visual del Core 002', () => {
  afterEach(cleanup);

  it('muestra umbrales, fuentes y pruebas en componentes compactos', () => {
    abrir();
    for (const titulo of ['Altman Z-Score', 'Piotroski F-Score', 'Veredicto de viabilidad', 'Riesgo por resultados']) {
      expect(screen.getByRole('heading', { name: titulo })).toBeTruthy();
    }
    for (const texto of ['SEC EDGAR', '10-K / 20-F', 'Webull', 'fechas de resultados', 'años fiscales consecutivos']) {
      expect(screen.getByText(texto)).toBeTruthy();
    }
    for (const rango of ['< 1.81', '1.81 – 2.99', '> 2.99', '< 1.10', '1.10 – 2.60', '> 2.60']) {
      expect(screen.getByText(rango)).toBeTruthy();
    }
    expect(screen.getByText('Financieras: N/A (sin cálculo Z → UNKNOWN)')).toBeTruthy();
    expect(document.body.textContent).toContain('mínimo 6 datos válidos');
    expect(document.body.textContent).toContain('Aporta el');
    expect(document.body.textContent).toContain('20 %');
    const pruebas = within(screen.getByRole('list', { name: '9 pruebas del F-Score' })).getAllByRole('listitem');
    expect(pruebas).toHaveLength(9);
    for (const etiqueta of [
      'ROA positivo', 'Flujo operativo +', 'ROA en mejora', 'Calidad de ganancias',
      'Menor deuda larga', 'Mejor liquidez', 'Sin dilución', 'Mejor margen bruto', 'Mayor rotación activos',
    ]) {
      expect(pruebas.some(item => item.textContent.includes(etiqueta))).toBe(true);
    }
    expect(document.body.textContent).toContain('Efectivo > utilidad');
    expect(screen.getByText(/Las velas OHLC pertenecen al Core 001/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/(?:^|[^\d])(?:0|4|7)\s*[–-]\s*(?:3|6|9)(?!\d)/);
  });

  it('muestra los cuatro veredictos y los cuatro niveles de riesgo', () => {
    abrir();
    const texto = document.body.textContent;
    for (const dato of ['VIABLE', 'MARGINAL', 'NO_VIABLE', 'UNKNOWN', 'Vetado del ranking', 'Datos insuficientes en los reportes']) {
      expect(texto).toContain(dato);
    }
    for (const dato of ['HIGH', '≤ 7 días', 'MEDIUM', '8 – 30 días', 'LOW', '> 30 días', 'UNVERIFIED', 'Sin fecha · no resta puntos (parcial)']) {
      expect(texto).toContain(dato);
    }
    expect(screen.getByText('Riesgo por resultados')).toBeTruthy();
  });

  it('muestra el peso y la regla GATE en dos columnas', () => {
    abrir();
    expect(screen.getByText('Peso en confluencia')).toBeTruthy();
    expect(screen.getByText('Regla GATE')).toBeTruthy();
    const { peso, participa } = CORES_INFO['002'];
    expect(screen.getByText(peso)).toBeTruthy();
    expect(screen.getByText(participa)).toBeTruthy();
    expect(peso).toContain('20 pts');
    expect(peso).toContain('25 %');
    expect(participa).toContain('GATE');
    expect(participa).toContain('MARGINAL');
    expect(participa).toContain('NO_VIABLE');
    expect(participa).toContain('Collar');
  });

  it('explica qué sigue pasando y qué deja de pasar sin seleccionar el 002, en lenguaje llano', () => {
    abrir();
    const seccion = screen.getByRole('heading', { name: 'Si no seleccionas el Core 002' }).closest('section');
    expect(within(seccion).getByText('Sigue pasando')).toBeTruthy();
    expect(within(seccion).getByText('Ya no pasa')).toBeTruthy();
    for (const frase of [
      'Se consultan igual las cuentas, el precio y la fecha de resultados.',
      'Se calculan la salud financiera, las pruebas contables y el veredicto de viabilidad.',
      'Las empresas sin salud financiera siguen quedando fuera y no se les busca collar.',
      'Puedes abrir su detalle y su trazabilidad como siempre.',
      'Su puntaje no entra en el ranking.',
      'No recibe peso y no aparece en la contribución.',
      'No cambia el orden de las empresas.',
      'No marca la fila como parcial por su propio estado.',
    ]) {
      expect(seccion.textContent).toContain(frase);
    }
    expect(within(seccion).getAllByRole('list')).toHaveLength(2);
    expect(within(seccion).getAllByRole('listitem')).toHaveLength(8);
    expect(seccion.textContent).not.toMatch(/effectiveWeight|CONFLUENCE|VIABILITY_VETO|PARTIAL|GATE/);
    expect(within(seccion).getByText('Sigue pasando').closest('div').className).toContain('bg-[var(--ui-panel)]');
  });

  it('solo ofrece el control de ayuda en el Core 002', () => {
    abrir();
    expect(ayuda()).toBeTruthy();
    const tablist = screen.getByRole('tablist');
    expect(tablist.contains(ayuda())).toBe(false);
    cleanup();
    abrir('001');
    expect(screen.queryByRole('button', { name: 'Qué significa seleccionar el Core 002' })).toBeNull();
    cleanup();
    abrir('004');
    expect(screen.queryByRole('button', { name: 'Qué significa seleccionar el Core 002' })).toBeNull();
  });

  it('abre el panel con ambos bloques y coloca el foco dentro', () => {
    abrir();
    fireEvent.click(ayuda());
    const abierto = panel();
    expect(abierto).toBeTruthy();
    expect(abierto.textContent).toContain('Seleccionado');
    expect(abierto.textContent).toContain('No seleccionado');
    expect(abierto.textContent).toContain('25 % efectivo');
    expect(abierto.textContent).toContain('sigue actuando como filtro de viabilidad');
    expect(document.activeElement).toBe(abierto);
  });

  it('cierra solo el panel con Escape y devuelve el foco al botón', () => {
    const onClose = () => { throw new Error('El modal no debe cerrarse con el panel abierto'); };
    abrir('002', onClose);
    const boton = ayuda();
    fireEvent.click(boton);
    fireEvent.keyDown(panel(), { key: 'Escape' });
    expect(panel()).toBeNull();
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(document.activeElement).toBe(boton);
  });
});
