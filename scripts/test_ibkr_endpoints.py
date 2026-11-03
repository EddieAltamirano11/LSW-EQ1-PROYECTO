import requests
import json
import time

BASE_URL = "http://localhost:3050/api/v1"
HEADERS_IBKR = {
    "x-broker-selection": "IBKR",
    "x-database-selection": "supabase",
    "Content-Type": "application/json"
}

results = []

def run_test(name, func):
    print(f"\n[{len(results)+1}] Ejecutando: {name}...")
    try:
        start = time.time()
        res = func()
        duration = round((time.time() - start) * 1000, 2)
        status = res.status_code if hasattr(res, 'status_code') else 'OK'
        success = status in [200, 201]
        results.append({'test': name, 'status': status, 'duration': f"{duration}ms", 'success': success})
        print(f"    [OK={success}] Status: {status} ({duration}ms)")
        try:
            data = res.json()
            snippet = json.dumps(data, indent=2)[:350]
            print(f"    Respuesta:\n{snippet}...")
        except Exception:
            print(f"    Respuesta: {res.text[:200]}")
    except Exception as e:
        results.append({'test': name, 'status': 'ERROR', 'error': str(e), 'success': False})
        print(f"    [ERROR]: {e}")

print("=" * 75)
print(" SUITE DE PRUEBAS EXHAUSTIVAS: INTERACTIVE BROKERS (TWS API SOCKET)")
print("=" * 75)

# 1. Health check
run_test("Health Check del Servidor", lambda: requests.get(f"{BASE_URL}/health"))

# 2. Account IBKR
run_test("Consultar Balance y Cuenta IBKR (DUR303142)", lambda: requests.get(f"{BASE_URL}/broker/account", headers=HEADERS_IBKR))

# 3. Quote AAPL IBKR
run_test("Consultar Cotizacion Spot AAPL en IBKR", lambda: requests.get(f"{BASE_URL}/broker/quote/AAPL", headers=HEADERS_IBKR))

# 4. Quote NVDA IBKR
run_test("Consultar Cotizacion Spot NVDA en IBKR", lambda: requests.get(f"{BASE_URL}/broker/quote/NVDA", headers=HEADERS_IBKR))

# 5. Options Chain AAPL IBKR
run_test("Consultar Cadena de Opciones AAPL en IBKR", lambda: requests.get(f"{BASE_URL}/broker/options-chain/AAPL?expiration=2026-10-16", headers=HEADERS_IBKR))

# 6. Positions IBKR
run_test("Consultar Posiciones Abiertas en IBKR", lambda: requests.get(f"{BASE_URL}/broker/positions", headers=HEADERS_IBKR))

# 7. Orders IBKR
run_test("Consultar Ordenes Bursatiles en IBKR", lambda: requests.get(f"{BASE_URL}/broker/orders", headers=HEADERS_IBKR))

# 8. Recommend PUT Option IBKR
run_test("Recomendar y Valuar Put Protector Optimo (F0) IBKR", lambda: requests.get(f"{BASE_URL}/hedging/recommend-option/AAPL?type=PUT&broker=IBKR&moneyness=OTM", headers=HEADERS_IBKR))

# 9. Recommend CALL Option IBKR
run_test("Recomendar y Valuar Call Financiador Optimo (F0) IBKR", lambda: requests.get(f"{BASE_URL}/hedging/recommend-option/AAPL?type=CALL&broker=IBKR&moneyness=OTM", headers=HEADERS_IBKR))

# 10. Place Stock Order IBKR
def place_stock():
    body = {
        "symbol": "AAPL",
        "qty": 100,
        "side": "buy",
        "type": "limit",
        "limitPrice": 345.00,
        "timeInForce": "day",
        "instrumentType": "EQUITY"
    }
    return requests.post(f"{BASE_URL}/broker/orders", json=body, headers=HEADERS_IBKR)
run_test("Emitir Orden de Compra de 100 Acciones AAPL en IBKR", place_stock)

# 11. Place Put Option Order IBKR
def place_put():
    body = {
        "symbol": "AAPL",
        "contractSymbol": "AAPL261016P00310000",
        "instrumentType": "OPTION",
        "optionType": "PUT",
        "strikePrice": 310,
        "expirationDate": "2026-10-16",
        "qty": 1,
        "side": "buy",
        "type": "limit",
        "limitPrice": 2.15,
        "timeInForce": "gtc"
    }
    return requests.post(f"{BASE_URL}/broker/orders", json=body, headers=HEADERS_IBKR)
run_test("Emitir Orden de Compra de Put Protector en IBKR", place_put)

# 12. Place Call Option Order IBKR (Covered Call)
def place_call():
    body = {
        "symbol": "AAPL",
        "contractSymbol": "AAPL261016C00380000",
        "instrumentType": "OPTION",
        "optionType": "CALL",
        "strikePrice": 380,
        "stockPrice": 347.73,
        "expirationDate": "2026-10-16",
        "qty": 1,
        "side": "sell",
        "type": "limit",
        "limitPrice": 2.50,
        "timeInForce": "gtc"
    }
    return requests.post(f"{BASE_URL}/broker/orders", json=body, headers=HEADERS_IBKR)
run_test("Emitir Orden de Venta de Short Call (Covered Call) en IBKR", place_call)

# 13. Cancel Order IBKR
def cancel_order():
    return requests.delete(f"{BASE_URL}/broker/orders/4", headers=HEADERS_IBKR)
run_test("Cancelar Orden Pendiente en IBKR", cancel_order)

# 14. Sync Underlying IBKR to Supabase
def sync_underlying():
    return requests.post(f"{BASE_URL}/broker/sync-underlying/AAPL?x-database-selection=supabase&x-broker-selection=IBKR", headers=HEADERS_IBKR)
run_test("Sincronizar Activo Subyacente AAPL desde IBKR a Supabase", sync_underlying)

# 15. Collar Spread Manual Persistence IBKR
def collar_spread():
    body = {
        "portfolioId": "PORT-IBKR-01",
        "broker": "IBKR",
        "symbol": "AAPL",
        "spotPrice": 347.73,
        "sharesCount": 100,
        "putStrike": 310,
        "callStrike": 380,
        "putPremium": 2.15,
        "callPremium": 2.50,
        "expirationDate": "2026-10-16T00:00:00.000Z"
    }
    return requests.post(f"{BASE_URL}/hedging/collar-spread", json=body, headers=HEADERS_IBKR)
run_test("Estructurar y Persistir Collar Spread con Broker IBKR", collar_spread)

# 16. Auto-Collar Complete Execution IBKR
def auto_collar():
    body = {
        "symbol": "AAPL",
        "sharesCount": 100,
        "portfolioId": "PORT-AUTO-IBKR",
        "broker": "IBKR",
        "expirationDate": "2026-10-16",
        "executeOrders": True
    }
    return requests.post(f"{BASE_URL}/hedging/auto-collar", json=body, headers=HEADERS_IBKR)
run_test("Ejecutar Auto-Collar Algoritmico Zero-Cost en IBKR (3 Ordenes Emitidas)", auto_collar)

print("\n" + "=" * 75)
print(" RESUMEN FINAL DE PRUEBAS")
print("=" * 75)
passed = sum(1 for r in results if r['success'])
total = len(results)
print(f"Total de Pruebas: {total} | Exitosas: {passed} | Fallidas: {total - passed}")
for r in results:
    mark = "OK" if r['success'] else "FAIL"
    print(f"  [{mark}] {r['test']}: HTTP {r['status']} ({r.get('duration', '')})")

