import { describe, expect, it } from 'vitest';
import { esRechazoDeSesion, tokenVencido, vencimientoDelToken } from './sesion.js';

const jwt = (carga) => `cabecera.${btoa(JSON.stringify(carga)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')}.firma`;

describe('vigencia de la sesión', () => {
  it('lee el vencimiento del JWT y distingue un token vencido', () => {
    const ahora = Date.parse('2026-11-21T12:00:00Z');
    const vence = ahora / 1000 + 60;
    expect(vencimientoDelToken(jwt({ exp: vence }))).toBe(vence * 1000);
    expect(tokenVencido(jwt({ exp: vence }), ahora)).toBe(false);
    expect(tokenVencido(jwt({ exp: vence }), ahora + 61_000)).toBe(true);
  });

  it('no descarta un token sin vencimiento legible (lo decide el backend)', () => {
    expect(tokenVencido('demo-jwt-simulated-token-equipo1')).toBe(false);
    expect(tokenVencido(jwt({ sub: 'x' }))).toBe(false);
  });

  it('solo un 401 con token hacia el backend de la sesión cierra la sesión', () => {
    const base = 'http://localhost:3050';
    const conToken = { headers: { Authorization: 'Bearer abc' } };
    expect(esRechazoDeSesion(`${base}/api/v1/broker/account`, conToken, 401, base)).toBe(true);
    expect(esRechazoDeSesion(`${base}/api/v1/broker/account`, conToken, 503, base)).toBe(false);
    expect(esRechazoDeSesion(`${base}/api/v1/auth/login`, { headers: {} }, 401, base)).toBe(false);
    expect(esRechazoDeSesion('https://otro.example/api', conToken, 401, base)).toBe(false);
  });
});
