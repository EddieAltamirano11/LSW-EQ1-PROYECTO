// scripts/test_comprehensive_apis.mjs
const BASE_URL = 'http://localhost:3050/api/v1';

async function testAll() {
  const results = [];
  let token = null;

  async function req(name, method, path, { headers = {}, body = null } = {}) {
    const opts = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    };
    if (body) opts.body = JSON.stringify(body);

    const start = Date.now();
    try {
      const res = await fetch(`${BASE_URL}${path}`, opts);
      const data = await res.json().catch(() => null);
      const duration = Date.now() - start;
      const pass = res.status >= 200 && res.status < 300;
      results.push({ name, method, path, status: res.status, pass, duration, error: pass ? null : data });
      console.log(`[${pass ? 'PASS' : 'FAIL'}] ${res.status} ${method} ${path} (${duration}ms)`);
      return { status: res.status, data };
    } catch (err) {
      const duration = Date.now() - start;
      results.push({ name, method, path, status: 500, pass: false, duration, error: err.message });
      console.log(`[ERR ] 500 ${method} ${path} - ${err.message}`);
      return { status: 500, data: null, error: err };
    }
  }

  console.log('=== INICIANDO SUITE DE PRUEBAS COMPLETA DE TODAS LAS APIS ===\n');

  // 1. Core & Spec
  await req('1. Root Health Check', 'GET', '');
  await req('2. OpenSpec Contract JSON', 'GET', '/spec.json');

  // 2. Auth
  const loginRes = await req('3. Login MongoDB', 'POST', '/auth/login', {
    body: { username: 'testuser', password: 'password123', databaseTarget: 'mongodb' }
  });
  if (loginRes.data && loginRes.data.token) {
    token = loginRes.data.token;
  }
  await req('4. Auth Session Check', 'GET', '/auth/session');

  // 3. Underlyings (MongoDB)
  await req('5. List Underlyings (Mongo)', 'GET', '/underlyings', { headers: { 'x-database-selection': 'mongodb' } });
  await req('6. Search Underlying by Symbol (Mongo)', 'GET', '/underlyings/symbol/NVDA', { headers: { 'x-database-selection': 'mongodb' } });
  const createdUnd = await req('7. Create Underlying (Mongo)', 'POST', '/underlyings', {
    headers: { 'x-database-selection': 'mongodb' },
    body: { symbol: `TST_${Date.now() % 10000}`, companyName: 'Test Corp', spotPrice: 150.5, volatility: 0.35 }
  });
  const undId = createdUnd.data?.id || createdUnd.data?._id;
  if (undId) {
    await req('8. Get Underlying by ID (Mongo)', 'GET', `/underlyings/${undId}`, { headers: { 'x-database-selection': 'mongodb' } });
    await req('9. Update Underlying by ID (Mongo)', 'PUT', `/underlyings/${undId}`, {
      headers: { 'x-database-selection': 'mongodb' },
      body: { spotPrice: 155.0, volatility: 0.38 }
    });
    await req('10. Delete Underlying by ID (Mongo)', 'DELETE', `/underlyings/${undId}`, { headers: { 'x-database-selection': 'mongodb' } });
  }

  // 4. Quant Black-Scholes & Implied Vol
  await req('11. Quant Black-Scholes Valuer F0', 'POST', '/quant/black-scholes', {
    body: { spotPrice: 220, strikePrice: 200, timeToExpirationYears: 0.1, volatility: 0.45, riskFreeRate: 0.045, optionType: 'PUT' }
  });
  await req('12. Quant Implied Volatility Newton-Raphson', 'POST', '/quant/implied-volatility', {
    body: { marketPrice: 4.5, spotPrice: 220, strikePrice: 200, timeToExpirationYears: 0.1, riskFreeRate: 0.045, optionType: 'PUT' }
  });

  // 5. Hedging - Recommend Option (PUT & CALL)
  await req('13. Recommend Option PUT (Webull)', 'GET', '/hedging/recommend-option/NVDA?type=PUT&broker=WEBULL');
  await req('14. Recommend Option CALL (Webull)', 'GET', '/hedging/recommend-option/NVDA?type=CALL&broker=WEBULL');
  await req('15. Recommend Option PUT (Alpaca)', 'GET', '/hedging/recommend-option/AAPL?type=PUT&broker=ALPACA');
  await req('16. Recommend Option CALL (Alpaca)', 'GET', '/hedging/recommend-option/AAPL?type=CALL&broker=ALPACA');

  // 6. Hedging - Auto-Collar (Simulation executeOrders: false)
  const simCollar = await req('17. Auto-Collar Simulation (Mongo)', 'POST', '/hedging/auto-collar', {
    headers: { 'x-database-selection': 'mongodb' },
    body: { symbol: 'NVDA', sharesCount: 5, broker: 'WEBULL', executeOrders: false }
  });

  // 7. Hedging - Protective Put & Collar Manual
  const protPut = await req('18. Create Protective Put (Mongo)', 'POST', '/hedging/protective-put', {
    headers: { 'x-database-selection': 'mongodb' },
    body: { symbol: 'NVDA', sharesCount: 5, putStrike: 200, putPremium: 2.5, expirationDate: '2026-10-16T00:00:00.000Z', broker: 'WEBULL' }
  });
  const collarManual = await req('19. Create Collar Spread Manual (Mongo)', 'POST', '/hedging/collar-spread', {
    headers: { 'x-database-selection': 'mongodb' },
    body: { symbol: 'NVDA', spotPrice: 221.3, sharesCount: 5, putStrike: 200, callStrike: 245, putPremium: 2.5, callPremium: 2.8, expirationDate: '2026-10-16T00:00:00.000Z', broker: 'WEBULL' }
  });

  const stratId = collarManual.data?.data?.id || simCollar.data?.strategy?.id || protPut.data?.data?.id;

  // 8. Subdocuments on Hedging Strategy
  if (stratId) {
    await req('20. Get Strategy by ID', 'GET', `/hedging/${stratId}`);
    await req('21. Update Strategy Status', 'PUT', `/hedging/${stratId}/status`, { body: { status: 'CLOSED' } });
    await req('22. Get Underlying Subdocument', 'GET', `/hedging/${stratId}/underlying`);
    await req('23. Update Underlying Subdocument', 'PUT', `/hedging/${stratId}/underlying`, { body: { spotPrice: 225.0, sharesCount: 5 } });
    const legsRes = await req('24. Get Legs Subdocument List', 'GET', `/hedging/${stratId}/legs`);
    const legId = legsRes.data?.[0]?.legId || legsRes.data?.[0]?.id || legsRes.data?.[0]?._id;
    if (legId) {
      await req('25. Get Single Leg Subdocument', 'GET', `/hedging/${stratId}/legs/${legId}`);
      await req('26. Update Single Leg Subdocument', 'PUT', `/hedging/${stratId}/legs/${legId}`, { body: { premium: 3.10 } });
    }
    await req('27. Add Single Leg Subdocument', 'POST', `/hedging/${stratId}/legs`, {
      body: { legRole: 'HEDGE_FLOOR', assetType: 'OPTION', optionType: 'PUT', strike: 190, entryPrice: 1.2, quantity: 1 }
    });
    await req('28. Get Strategy Financial Metrics Subdocument', 'GET', `/hedging/${stratId}/financial-metrics`);
    await req('29. Recalculate Financial Metrics Subdocument', 'PUT', `/hedging/${stratId}/financial-metrics/recalculate`, { body: { currentSpotPrice: 222.0 } });
    await req('30. Generate Payoff Matrix (P&L)', 'GET', `/hedging/${stratId}/payoff-matrix?steps=10`);
  }

  // 9. Broker Endpoints - Webull
  await req('31. Webull Account Telemetry', 'GET', '/broker/account', { headers: { 'x-broker-selection': 'WEBULL' } });
  await req('32. Webull Positions', 'GET', '/broker/positions', { headers: { 'x-broker-selection': 'WEBULL' } });
  await req('33. Webull Orders List', 'GET', '/broker/orders', { headers: { 'x-broker-selection': 'WEBULL' } });
  await req('34. Webull Quote NVDA', 'GET', '/broker/quote/NVDA', { headers: { 'x-broker-selection': 'WEBULL' } });
  await req('35. Webull Options Chain NVDA', 'GET', '/broker/options-chain/NVDA', { headers: { 'x-broker-selection': 'WEBULL' } });

  // 10. Broker Endpoints - Alpaca
  await req('36. Alpaca Account Telemetry', 'GET', '/broker/account', { headers: { 'x-broker-selection': 'ALPACA' } });
  await req('37. Alpaca Positions', 'GET', '/broker/positions', { headers: { 'x-broker-selection': 'ALPACA' } });
  await req('38. Alpaca Orders List', 'GET', '/broker/orders', { headers: { 'x-broker-selection': 'ALPACA' } });
  await req('39. Alpaca Quote AAPL', 'GET', '/broker/quote/AAPL', { headers: { 'x-broker-selection': 'ALPACA' } });
  await req('40. Alpaca Options Chain AAPL', 'GET', '/broker/options-chain/AAPL', { headers: { 'x-broker-selection': 'ALPACA' } });

  // 11. Real Broker Order Execution (Limit max 5 shares)
  // Webull: Single stock limit buy order (1 share)
  await req('41. Webull Order Emission (1 share NVDA limit)', 'POST', '/broker/orders', {
    headers: { 'x-broker-selection': 'WEBULL' },
    body: { symbol: 'NVDA', qty: 1, side: 'buy', type: 'limit', limitPrice: 150.0, timeInForce: 'day' }
  });

  // Alpaca: Single stock limit buy order (1 share)
  await req('42. Alpaca Order Emission (1 share AAPL limit)', 'POST', '/broker/orders', {
    headers: { 'x-broker-selection': 'ALPACA' },
    body: { symbol: 'AAPL', qty: 1, side: 'buy', type: 'limit', limitPrice: 150.0, timeInForce: 'day' }
  });

  // 12. Auto-Collar with Live Execution (executeOrders: true)
  // Webull (5 shares)
  await req('43. Auto-Collar Live Execution Webull (5 shares)', 'POST', '/hedging/auto-collar', {
    headers: { 'x-database-selection': 'mongodb', 'x-broker-selection': 'WEBULL' },
    body: { symbol: 'NVDA', sharesCount: 5, broker: 'WEBULL', executeOrders: true }
  });

  // Alpaca (5 shares)
  await req('44. Auto-Collar Live Execution Alpaca (5 shares)', 'POST', '/hedging/auto-collar', {
    headers: { 'x-database-selection': 'supabase', 'x-broker-selection': 'ALPACA' },
    body: { symbol: 'AAPL', sharesCount: 5, broker: 'ALPACA', executeOrders: true }
  });

  // Summary
  console.log('\n=== RESUMEN FINAL DE PRUEBAS ===');
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  console.log(`Total pruebas: ${results.length} | Aprobadas: ${passed} | Fallidas: ${failed}`);

  if (failed > 0) {
    console.log('\nDetalles de pruebas fallidas:');
    results.filter(r => !r.pass).forEach(f => {
      console.log(`- ${f.name} (${f.method} ${f.path}) -> Status: ${f.status}`);
      console.log(`  Respuesta:`, JSON.stringify(f.error, null, 2));
    });
  }
}

testAll().catch(console.error);

