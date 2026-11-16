import axios from 'axios';

const API_BASE = 'http://[::1]:3050/api/v1';

async function run() {
  console.log('========================================================');
  console.log('   TEST DE EJECUCIÓN MULTI-BROKER (LIVE/STRICT MODE)    ');
  console.log('========================================================\n');

  // 1. Login
  console.log('1. Autenticación y obtención de JWT...');
  const loginRes = await axios.post(`${API_BASE}/auth/login`, {
    username: 'demo.trader',
    password: 'demoPassword123',
    databaseTarget: 'supabase',
  });
  const token = loginRes.data.token;
  console.log('   [OK] Token obtenido exitosamente en Supabase.\n');

  const headers = (broker) => ({
    Authorization: `Bearer ${token}`,
    'x-database-selection': 'supabase',
    'x-broker-selection': broker,
    'Content-Type': 'application/json',
  });

  const brokers = ['WEBULL', 'ALPACA', 'IBKR'];

  // 2. Probar Cuenta en cada Broker
  console.log('2. Consultando cuentas de los 3 Brokers...');
  for (const b of brokers) {
    try {
      const res = await axios.get(`${API_BASE}/broker/account?broker=${b}`, { headers: headers(b), timeout: 12000 });
      console.log(`   [OK] Cuenta ${b}: Status=${res.status} | ID=${res.data.accountId || res.data.accountNumber} | Cash=$${res.data.cash} | Portfolio=$${res.data.portfolioValue}`);
    } catch (e) {
      console.error(`   [ERROR] Cuenta ${b}: ${e.response?.status || e.code} - ${e.response?.data?.message || e.message}`);
    }
  }
  console.log('');

  // 3. Probar Orden de Acciones (Equity Limit Order) en cada Broker
  console.log('3. Emitiendo órdenes directas de Acciones (Equity)...');
  for (const b of brokers) {
    try {
      const payload = {
        broker: b,
        symbol: 'AAPL',
        qty: 1,
        side: 'buy',
        type: 'limit',
        limitPrice: 150.00, // Precio límite defensivo bajo mercado para no llenarse indeseadamente pero validar matching engine
        instrumentType: 'EQUITY',
        timeInForce: 'day',
      };
      const res = await axios.post(`${API_BASE}/broker/orders?broker=${b}`, payload, { headers: headers(b), timeout: 15000 });
      console.log(`   [OK] Orden Acciones ${b}: Status=${res.status} | OrderId=${res.data.order?.id || res.data.id || 'OK'} | Msg=${res.data.message}`);
    } catch (e) {
      console.error(`   [RESPUESTA] Orden Acciones ${b}: ${e.response?.status || e.code} - ${e.response?.data?.message || e.message}`);
    }
  }
  console.log('');

  // 4. Probar Protective Put en cada Broker
  console.log('4. Emitiendo Cobertura Protective Put (con executeOrders: true)...');
  for (const b of brokers) {
    try {
      const payload = {
        symbol: 'AAPL',
        spotPrice: 227.50,
        sharesCount: 100,
        putStrike: 215.00,
        putPremium: 3.50,
        expirationDate: '2026-12-18T00:00:00.000Z',
        broker: b,
        executeOrders: true,
        buyUnderlying: false, // Solo la opción Put para no consumir exceso de buying power
      };
      const res = await axios.post(`${API_BASE}/hedging/protective-put`, payload, { headers: headers(b), timeout: 20000 });
      const exec = res.data.data?.brokerExecution || {};
      const orders = exec.orders || [];
      const orderIds = orders.map((o) => o.orderId || o.id).join(', ');
      console.log(`   [OK] Protective Put ${b}: Status=${res.status} | Estrategia=${res.data.data?.id} | Órdenes Emitidas=${orders.length} [${orderIds || 'N/A'}]`);
    } catch (e) {
      console.error(`   [RESPUESTA] Protective Put ${b}: ${e.response?.status || e.code} - ${e.response?.data?.message || e.message}`);
    }
  }
  console.log('');

  // 5. Probar Auto-Collar en cada Broker
  console.log('5. Emitiendo Auto-Collar Spread (con executeOrders: true)...');
  for (const b of brokers) {
    try {
      const payload = {
        symbol: 'AAPL',
        sharesCount: 100,
        portfolioId: `PORT-TEST-${b}`,
        expirationDate: '2026-12-18',
        broker: b,
        executeOrders: true,
        buyUnderlying: false,
      };
      const res = await axios.post(`${API_BASE}/hedging/auto-collar`, payload, { headers: headers(b), timeout: 20000 });
      const orders = res.data.brokerExecution?.orders || [];
      console.log(`   [OK] Auto-Collar ${b}: Status=${res.status} | Órdenes Emitidas=${orders.length} | Broker=${b}`);
    } catch (e) {
      console.error(`   [RESPUESTA] Auto-Collar ${b}: ${e.response?.status || e.code} - ${e.response?.data?.message || e.message}`);
    }
  }
  console.log('');

  // 6. Probar Strategy Screener con credenciales SEC EDGAR en vivo
  console.log('6. Ejecutando Strategy Screener v2 con credenciales SEC EDGAR...');
  try {
    const screenerRes = await axios.post('http://[::1]:3050/api/v2/strategy-screener/run', {
      mode: 'BY_STRATEGY',
      strategy: 'COLLAR_SPREAD',
      activeCores: ['001', '002', '003', '005', '006'],
      limit: 4,
      dteHorizon: 45,
    }, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
    console.log(`   [OK] Screener Status: ${screenerRes.status} | Candidatos viables: ${screenerRes.data?.candidates?.length || 0}`);
    for (const c of (screenerRes.data?.candidates || []).slice(0, 3)) {
      const coreKeys = Object.keys(c.cores || {});
      console.log(`        -> ${c.symbol} (${c.companyName}): Estado=${c.eligibility} | Cores Evaluados: [${coreKeys.join(', ')}]`);
    }
  } catch (e) {
    console.error(`   [RESPUESTA] Screener EDGAR: ${e.response?.status || e.code} - ${e.response?.data?.message || e.message}`);
  }

  console.log('\n========================================================');
  console.log('   PRUEBAS FINALIZADAS                                  ');
  console.log('========================================================');
}

run().catch(console.error);
