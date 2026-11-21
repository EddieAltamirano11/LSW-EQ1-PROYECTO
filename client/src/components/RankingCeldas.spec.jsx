import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { CeldaCores, CeldasCollar } from './RankingCeldas';
import { collarDeFila } from '../services/rankingCollar';
import { candidatoEscaner, filaCores } from '../services/__fixtures__/ranking';

const fila = hijos => render(<table><tbody><tr>{hijos}</tr></tbody></table>);

describe('celdas del ranking', () => {
  afterEach(cleanup);

  it('fila con collar real: contratos, primas observadas, débito, marca Real · Core 004 y probabilidad que no aplica', () => {
    fila(<CeldasCollar collar={collarDeFila(candidatoEscaner, filaCores)} />);
    expect(screen.getByText('$330 Put')).toBeTruthy();
    expect(screen.getByText(/2026-12-31 · ask \$9.20/)).toBeTruthy();
    expect(screen.getByText(/bid \$5.20/)).toBeTruthy();
    expect(screen.getByText('Débito $4.00/acc')).toBeTruthy();
    expect(screen.getByText('Real · Core 004 · 15:55 ET')).toBeTruthy();
    expect(screen.getByText('No aplica')).toBeTruthy();
    expect(screen.getByText('+3.67%')).toBeTruthy();
    expect(screen.queryByText(/88.1/)).toBeNull();
  });

  it('fila teórica: valores del escáner marcados como teóricos y con su probabilidad', () => {
    fila(<CeldasCollar collar={collarDeFila(candidatoEscaner, null)} />);
    expect(screen.getByText('$325 Put')).toBeTruthy();
    expect(screen.getByText('Crédito $0.30/acc')).toBeTruthy();
    expect(screen.getByText(/Teórico/)).toBeTruthy();
    expect(screen.getByText('88.1%')).toBeTruthy();
    expect(screen.queryByText(/Real · Core 004/)).toBeNull();
  });

  it('fila excluida sin collar: indica Sin collar líquido con la causa, no un veto', () => {
    fila(<CeldaCores excluida={{ symbol: 'XYZ', exclusionType: 'NO_COLLAR', reason: 'No hay un put y un call compatibles.' }} />);
    expect(screen.getByText('Sin collar líquido')).toBeTruthy();
    expect(screen.getByText('No hay un put y un call compatibles.')).toBeTruthy();
    expect(screen.queryByText(/Veto/)).toBeNull();
  });

  it('fila apta muestra el puntaje de los cores', () => {
    fila(<CeldaCores apta={{ symbol: 'AAPL', score: 68.63, eligibility: 'VIABLE' }} />);
    expect(screen.getByText('68.6/100 · Viable')).toBeTruthy();
  });
});
