import requests
import json
import time
import sys

BASE_URL = "https://lsw-eq1-proyecto.onrender.com/api/v1"

BROKERS = ["webull", "alpaca", "IBKR"]
results = []

def run_test(name, func, expected_status=[200, 201]):
    print(f"\n[TEST {len(results)+1}] {name}")
    try:
        start = time.time()
        res = func()
        duration = round((time.time() - start) * 1000, 2)
        status = res.status_code if hasattr(res, 'status_code') else 'OK'
        success = status in expected_status
        results.append({'test': name, 'status': status, 'duration': f"{duration}ms", 'success': success})
        mark = "PASS" if success else "FAIL"
        print(f"    [{mark}] Status: {status} (Expected: {expected_status}) en {duration}ms")
        try:
            data = res.json()
            snippet = json.dumps(data, indent=2)[:300]
            print(f"    Payload:\n{snippet}...")
        except Exception:
            print(f"    Raw: {res.text[:200]}")
    except Exception as e:
        results.append({'test': name, 'status': 'ERROR', 'error': str(e), 'success': False})
        print(f"    [FAIL/ERROR]: {e}")

print("=" * 80)
print(f" SUITE DE VERIFICACION EN LA NUBE RENDER: {BASE_URL}")
print(" Arquitectura Unificada: Headers para Infraestructura (Opcion B)")
print("=" * 80)

# 1. Health
run_test("Health Check Render", lambda: requests.get(f"{BASE_URL}/health", timeout=15))

# 2. Account, Positions, Orders por cada broker usando x-broker-selection
for b in BROKERS:
    db = "mongodb" if b == "webull" else "supabase"
    headers = {
        "x-broker-selection": b,
        "x-database-selection": db,
        "Content-Type": "application/json"
    }
    run_test(f"Consultar Cuenta Broker: {b} (DB: {db})",
             lambda h=headers: requests.get(f"{BASE_URL}/broker/account", headers=h, timeout=20))

    run_test(f"Consultar Posiciones Broker: {b} (DB: {db})",
             lambda h=headers: requests.get(f"{BASE_URL}/broker/positions", headers=h, timeout=20))

    run_test(f"Consultar Ordenes Broker: {b} (DB: {db})",
             lambda h=headers: requests.get(f"{BASE_URL}/broker/orders?status=all", headers=h, timeout=20))

# 3. Test de colocacion de orden SELL (para verificar que las ventas funcionan en cada broker)
# En IBKR emitimos una orden SELL LMT alta (out-of-the-money limit) para que no se ejecute inmediatamente
headers_ibkr = {"x-broker-selection": "IBKR", "x-database-selection": "supabase", "Content-Type": "application/json"}
body_ibkr_sell = {
    "symbol": "AAPL",
    "qty": 1,
    "side": "sell",
    "type": "limit",
    "limitPrice": 420.0,
    "timeInForce": "day"
}
run_test("IBKR: Colocar Orden bursatil SELL LMT",
         lambda: requests.post(f"{BASE_URL}/broker/orders", json=body_ibkr_sell, headers=headers_ibkr, timeout=20))

# 4. Validacion estricta de fecha de expiracion pasada en Auto-Collar
# Debe fallar con HTTP 400 Bad Request y no persistir nada en base de datos
body_expired_collar = {
    "symbol": "AAPL",
    "currentStockPrice": 220.0,
    "expirationDate": "2026-10-16",  # FECHA PASADA (< 2026-11-06)
    "moneyness": 0.05,
    "executeOrders": False
}
run_test("Auto-Collar: Rechazo estricto de fecha de expiracion pasada (2026-10-16 -> HTTP 400)",
         lambda: requests.post(f"{BASE_URL}/hedging/auto-collar", json=body_expired_collar, headers=headers_ibkr, timeout=15),
         expected_status=[400])

# 5. Auto-Collar con fecha futura valida (2026-12-18) y executeOrders=False (Solo recomendacion cuantitativa)
body_future_collar_sim = {
    "symbol": "AAPL",
    "currentStockPrice": 220.0,
    "expirationDate": "2026-12-18",
    "moneyness": 0.05,
    "executeOrders": False
}
run_test("Auto-Collar IBKR: Fecha futura (2026-12-18) sin ejecucion (solo recomendacion, sin BD falsa)",
         lambda: requests.post(f"{BASE_URL}/hedging/auto-collar", json=body_future_collar_sim, headers=headers_ibkr, timeout=20),
         expected_status=[200, 201])

# 6. Auto-Collar con fecha futura valida en Alpaca
headers_alpaca = {"x-broker-selection": "alpaca", "x-database-selection": "supabase", "Content-Type": "application/json"}
body_alpaca_collar_sim = {
    "symbol": "AAPL",
    "currentStockPrice": 220.0,
    "expirationDate": "2026-12-18",
    "moneyness": 0.05,
    "executeOrders": False
}
run_test("Auto-Collar Alpaca: Fecha futura (2026-12-18) sin ejecucion",
         lambda: requests.post(f"{BASE_URL}/hedging/auto-collar", json=body_alpaca_collar_sim, headers=headers_alpaca, timeout=20),
         expected_status=[200, 201])

# 7. Resumen final
print("\n" + "=" * 80)
print(" RESUMEN GENERAL DE PRUEBAS EN RENDER (OPCION B - HEADERS)")
print("=" * 80)
passed = [r for r in results if r['success']]
failed = [r for r in results if not r['success']]
print(f"Total pruebas: {len(results)} | Exitosas: {len(passed)} | Fallidas: {len(failed)}")
for r in results:
    status_icon = "PASS" if r['success'] else "FAIL"
    print(f" - [{status_icon}] {r['test']}: Status {r.get('status')} ({r.get('duration', 'N/A')})")

if failed:
    sys.exit(1)
print("\nTodas las pruebas en Render operaron satisfactoriamente bajo la Arquitectura de Headers Unificada.")

