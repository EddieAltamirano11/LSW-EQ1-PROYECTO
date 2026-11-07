import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import jwt from 'jsonwebtoken';
import config from '../src/config/config.js';
import { databaseContextMiddleware } from '../src/middlewares/databaseContext.middleware.js';
import { brokerContextMiddleware } from '../src/middlewares/brokerContext.middleware.js';
import { authMiddleware } from '../src/middlewares/auth.middleware.js';

function response() { return { setHeader: mock.fn() }; }

test('[unitaria] encabezado de BD prevalece sobre JWT query y cuerpo', () => {
  const req = { headers: { 'x-database-selection': 'SUPABASE' }, user: { dbTarget: 'mongodb' }, query: { database: 'mongodb' }, body: { databaseTarget: 'mongodb' } };
  const res = response(); const next = mock.fn();
  databaseContextMiddleware(req, res, next);
  assert.equal(req.dbTarget, 'supabase');
  assert.equal(req.body.databaseTarget, 'supabase');
  assert.deepEqual(res.setHeader.mock.calls[0].arguments, ['X-Active-Database', 'supabase']);
  assert.equal(next.mock.callCount(), 1);
});

test('[unitaria] JWT selecciona BD cuando el encabezado es inválido', () => {
  const req = { headers: { 'x-database-selection': 'desconocida' }, user: { dbTarget: 'supabase' }, query: {}, body: {} };
  databaseContextMiddleware(req, response(), mock.fn());
  assert.equal(req.dbTarget, 'supabase');
});

test('[unitaria] sin selección válida se usa MongoDB', () => {
  const req = { headers: {}, query: {}, body: {} };
  databaseContextMiddleware(req, response(), mock.fn());
  assert.equal(req.dbTarget, 'mongodb');
});

test('[unitaria] encabezado de broker prevalece sobre query y cuerpo', () => {
  const req = { headers: { 'x-broker-selection': 'alpaca' }, query: { broker: 'IBKR' }, body: { broker: 'WEBULL' } };
  const res = response();
  brokerContextMiddleware(req, res, mock.fn());
  assert.equal(req.broker, 'ALPACA');
  assert.equal(req.body.broker, 'ALPACA');
  assert.deepEqual(res.setHeader.mock.calls[0].arguments, ['X-Active-Broker', 'ALPACA']);
});

test('[unitaria] middleware verifica un JWT válido sin consultas externas', () => {
  const token = jwt.sign({ userId: 'unit-user', dbTarget: 'supabase' }, config.JWT_SECRET, { expiresIn: '1m' });
  const req = { headers: { authorization: `Bearer ${token}` } }; const next = mock.fn();
  authMiddleware(req, {}, next);
  assert.equal(req.user.userId, 'unit-user');
  assert.equal(next.mock.calls[0].arguments.length, 0);
});

test('[unitaria] middleware rechaza un JWT con firma incorrecta', () => {
  const token = jwt.sign({ userId: 'intruso' }, `${config.JWT_SECRET}-wrong`);
  const req = { headers: { authorization: `Bearer ${token}` } }; const next = mock.fn();
  authMiddleware(req, {}, next);
  assert.equal(next.mock.calls[0].arguments[0].output.statusCode, 401);
  assert.equal(req.user, undefined);
});
