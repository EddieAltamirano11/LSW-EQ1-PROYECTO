import json

TUNNEL_URL = "https://consist-overall-leaders-supplement.trycloudflare.com"
HOST_PARTS = ["consist-overall-leaders-supplement", "trycloudflare", "com"]

def make_url(path, query=None):
    raw = f"{TUNNEL_URL}/api/v1/{path}"
    if query:
        q_str = "&".join(f"{q['key']}={q['value']}" for q in query)
        raw += f"?{q_str}"
    
    url_obj = {
        "raw": raw,
        "protocol": "https",
        "host": HOST_PARTS,
        "path": ["api", "v1"] + path.split("/")
    }
    if query:
        url_obj["query"] = query
    return url_obj

collection = {
  "info": {
    "_postman_id": "29bd2619-9d1e-4c01-b368-90f726381b41",
    "name": "LSW - Coberturas Financieras (Equipo 1 - Cloudflare)",
    "description": "Colección completa y calibrada para el backend de Coberturas Financieras (Equipo 1) a través de Cloudflare Tunnel. Incluye flujos paso a paso para Webull, Alpaca e Interactive Brokers (IBKR).",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "U1 (Servicios Base)",
      "item": [
        {
          "name": "GET_List ProdServ",
          "request": {
            "method": "GET",
            "header": [],
            "url": {
              "raw": "http://localhost:3020/api/v1/prod-serv",
              "protocol": "http",
              "host": ["localhost"],
              "port": "3020",
              "path": ["api", "v1", "prod-serv"]
            }
          },
          "response": []
        }
      ]
    },
    {
      "name": "PROYECTO",
      "item": [
        {
          "name": "HealthCheck_Servidor",
          "request": {
            "method": "GET",
            "header": [],
            "url": make_url("health")
          },
          "response": []
        },
        {
          "name": "TutorialWebull",
          "item": [
            {
              "name": "0_Consultar Balance y Cuenta en Webull",
              "request": {
                "method": "GET",
                "header": [
                  { "key": "x-broker-selection", "value": "WEBULL" }
                ],
                "url": make_url("broker/account", [{"key": "broker", "value": "WEBULL"}])
              },
              "response": []
            },
            {
              "name": "0_Consultar Posiciones Abiertas en Webull",
              "request": {
                "method": "GET",
                "header": [
                  { "key": "x-broker-selection", "value": "WEBULL" }
                ],
                "url": make_url("broker/positions", [{"key": "broker", "value": "WEBULL"}])
              },
              "response": []
            },
            {
              "name": "1_Consultar Cotización Spot en Tiempo Real de Webull",
              "request": {
                "method": "GET",
                "header": [
                  { "key": "x-broker-selection", "value": "WEBULL" }
                ],
                "url": make_url("broker/quote/NVDA")
              },
              "response": []
            },
            {
              "name": "2_Consultar la Cadena de Opciones en Webull",
              "request": {
                "method": "GET",
                "header": [
                  { "key": "x-broker-selection", "value": "WEBULL" }
                ],
                "url": make_url("broker/options-chain/NVDA", [{"key": "expiration", "value": "2026-10-16"}])
              },
              "response": []
            },
            {
              "name": "3_Recomendar y Valuar la Opción Put Protectora Óptima (F0) Webull",
              "request": {
                "method": "GET",
                "header": [
                  { "key": "x-broker-selection", "value": "WEBULL" }
                ],
                "url": make_url("hedging/recommend-option/NVDA", [
                  {"key": "type", "value": "PUT"},
                  {"key": "broker", "value": "WEBULL"},
                  {"key": "moneyness", "value": "OTM"}
                ])
              },
              "response": []
            },
            {
              "name": "4_Recomendar y Valuar la Opción Call Financiadora Óptima (F0) Webull",
              "request": {
                "method": "GET",
                "header": [
                  { "key": "x-broker-selection", "value": "WEBULL" }
                ],
                "url": make_url("hedging/recommend-option/NVDA", [
                  {"key": "type", "value": "CALL"},
                  {"key": "broker", "value": "WEBULL"},
                  {"key": "moneyness", "value": "OTM"}
                ])
              },
              "response": []
            },
            {
              "name": "5_Emitir Orden de Compra de Acciones en Webull",
              "request": {
                "method": "POST",
                "header": [
                  { "key": "x-broker-selection", "value": "WEBULL" },
                  { "key": "Content-Type", "value": "application/json" }
                ],
                "body": {
                  "mode": "raw",
                  "raw": json.dumps({
                    "symbol": "NVDA",
                    "qty": 100,
                    "side": "buy",
                    "type": "limit",
                    "limitPrice": 214.50,
                    "timeInForce": "day"
                  }, indent=2),
                  "options": { "raw": { "language": "json" } }
                },
                "url": make_url("broker/orders")
              },
              "response": []
            },
            {
              "name": "6_Emitir Orden de Compra del Put Protector en Webull (Simbología OCC)",
              "request": {
                "method": "POST",
                "header": [
                  { "key": "x-broker-selection", "value": "WEBULL" },
                  { "key": "Content-Type", "value": "application/json" }
                ],
                "body": {
                  "mode": "raw",
                  "raw": json.dumps({
                    "symbol": "NVDA",
                    "contractSymbol": "NVDA261016P00195000",
                    "instrumentType": "OPTION",
                    "optionType": "PUT",
                    "strikePrice": 195,
                    "expirationDate": "2026-10-16",
                    "qty": 1,
                    "side": "buy",
                    "type": "limit",
                    "limitPrice": 2.57,
                    "timeInForce": "gtc"
                  }, indent=2),
                  "options": { "raw": { "language": "json" } }
                },
                "url": make_url("broker/orders")
              },
              "response": []
            },
            {
              "name": "7_Emitir Orden de Venta del Short Call en Webull (Simbología OCC)",
              "request": {
                "method": "POST",
                "header": [
                  { "key": "x-broker-selection", "value": "WEBULL" },
                  { "key": "Content-Type", "value": "application/json" }
                ],
                "body": {
                  "mode": "raw",
                  "raw": json.dumps({
                    "symbol": "NVDA",
                    "contractSymbol": "NVDA261016C00225000",
                    "instrumentType": "OPTION",
                    "optionType": "CALL",
                    "strikePrice": 225,
                    "stockPrice": 214.13,
                    "expirationDate": "2026-10-16",
                    "qty": 1,
                    "side": "sell",
                    "type": "limit",
                    "limitPrice": 2.26,
                    "timeInForce": "gtc"
                  }, indent=2),
                  "options": { "raw": { "language": "json" } }
                },
                "url": make_url("broker/orders")
              },
              "response": []
            },
            {
              "name": "8_Estructurar y Persistir la Cobertura en MongoDB Atlas",
              "request": {
                "method": "POST",
                "header": [
                  { "key": "x-database-selection", "value": "mongodb" },
                  { "key": "Content-Type", "value": "application/json" }
                ],
                "body": {
                  "mode": "raw",
                  "raw": json.dumps({
                    "portfolioId": "PORT-WEBULL-01",
                    "broker": "WEBULL",
                    "symbol": "NVDA",
                    "spotPrice": 214.13,
                    "sharesCount": 100,
                    "putStrike": 195,
                    "callStrike": 225,
                    "putPremium": 2.47,
                    "callPremium": 2.36,
                    "expirationDate": "2026-10-16T00:00:00.000Z"
                  }, indent=2),
                  "options": { "raw": { "language": "json" } }
                },
                "url": make_url("hedging/collar-spread")
              },
              "response": []
            },
            {
              "name": "9_AutomáticoWebull (Zero-Cost Auto-Collar)",
              "request": {
                "method": "POST",
                "header": [
                  { "key": "x-database-selection", "value": "mongodb" },
                  { "key": "x-broker-selection", "value": "WEBULL" },
                  { "key": "Content-Type", "value": "application/json" }
                ],
                "body": {
                  "mode": "raw",
                  "raw": json.dumps({
                    "symbol": "NVDA",
                    "sharesCount": 100,
                    "portfolioId": "PORT-AUTO-WEBULL",
                    "broker": "WEBULL",
                    "expirationDate": "2026-10-16",
                    "executeOrders": True
                  }, indent=2),
                  "options": { "raw": { "language": "json" } }
                },
                "url": make_url("hedging/auto-collar")
              },
              "response": []
            }
          ]
        },
        {
          "name": "TutorialAlpaca",
          "item": [
            {
              "name": "0_Consultar Balance y Cuenta en Alpaca",
              "request": {
                "method": "GET",
                "header": [
                  { "key": "x-broker-selection", "value": "ALPACA" }
                ],
                "url": make_url("broker/account", [{"key": "broker", "value": "ALPACA"}])
              },
              "response": []
            },
            {
              "name": "0_Consultar Posiciones Abiertas en Alpaca",
              "request": {
                "method": "GET",
                "header": [
                  { "key": "x-broker-selection", "value": "ALPACA" }
                ],
                "url": make_url("broker/positions", [{"key": "broker", "value": "ALPACA"}])
              },
              "response": []
            },
            {
              "name": "1_Consultar Cotización Spot en Alpaca (IEX Feed)",
              "request": {
                "method": "GET",
                "header": [
                  { "key": "x-broker-selection", "value": "ALPACA" }
                ],
                "url": make_url("broker/quote/AAPL")
              },
              "response": []
            },
            {
              "name": "2_Consultar la Cadena de Opciones en Alpaca",
              "request": {
                "method": "GET",
                "header": [
                  { "key": "x-broker-selection", "value": "ALPACA" }
                ],
                "url": make_url("broker/options-chain/AAPL", [{"key": "expiration", "value": "2026-10-16"}])
              },
              "response": []
            },
            {
              "name": "3_Recomendar y Valuar la Opción Put Protectora Óptima (F0) Alpaca",
              "request": {
                "method": "GET",
                "header": [
                  { "key": "x-broker-selection", "value": "ALPACA" }
                ],
                "url": make_url("hedging/recommend-option/AAPL", [
                  {"key": "type", "value": "PUT"},
                  {"key": "broker", "value": "ALPACA"},
                  {"key": "moneyness", "value": "OTM"}
                ])
              },
              "response": []
            },
            {
              "name": "4_Recomendar y Valuar la Opción Call Financiadora Óptima (F0) Alpaca",
              "request": {
                "method": "GET",
                "header": [
                  { "key": "x-broker-selection", "value": "ALPACA" }
                ],
                "url": make_url("hedging/recommend-option/AAPL", [
                  {"key": "type", "value": "CALL"},
                  {"key": "broker", "value": "ALPACA"},
                  {"key": "moneyness", "value": "OTM"}
                ])
              },
              "response": []
            },
            {
              "name": "5_Emitir Orden de Compra de Acciones en Alpaca",
              "request": {
                "method": "POST",
                "header": [
                  { "key": "x-broker-selection", "value": "ALPACA" },
                  { "key": "Content-Type", "value": "application/json" }
                ],
                "body": {
                  "mode": "raw",
                  "raw": json.dumps({
                    "symbol": "AAPL",
                    "qty": 100,
                    "side": "buy",
                    "type": "limit",
                    "limitPrice": 345.00,
                    "timeInForce": "day"
                  }, indent=2),
                  "options": { "raw": { "language": "json" } }
                },
                "url": make_url("broker/orders")
              },
              "response": []
            },
            {
              "name": "6_Emitir Orden de Compra del Put Protector en Alpaca (Simbología OCC)",
              "request": {
                "method": "POST",
                "header": [
                  { "key": "x-broker-selection", "value": "ALPACA" },
                  { "key": "Content-Type", "value": "application/json" }
                ],
                "body": {
                  "mode": "raw",
                  "raw": json.dumps({
                    "symbol": "AAPL261016P00310000",
                    "qty": 1,
                    "side": "buy",
                    "type": "limit",
                    "limitPrice": 2.15,
                    "timeInForce": "day"
                  }, indent=2),
                  "options": { "raw": { "language": "json" } }
                },
                "url": make_url("broker/orders")
              },
              "response": []
            },
            {
              "name": "7_Emitir Orden de Venta del Short Call en Alpaca (Simbología OCC)",
              "request": {
                "method": "POST",
                "header": [
                  { "key": "x-broker-selection", "value": "ALPACA" },
                  { "key": "Content-Type", "value": "application/json" }
                ],
                "body": {
                  "mode": "raw",
                  "raw": json.dumps({
                    "symbol": "AAPL261016C00360000",
                    "qty": 1,
                    "side": "sell",
                    "type": "limit",
                    "limitPrice": 2.50,
                    "timeInForce": "day"
                  }, indent=2),
                  "options": { "raw": { "language": "json" } }
                },
                "url": make_url("broker/orders")
              },
              "response": []
            },
            {
              "name": "8_Estructurar y Persistir la Cobertura en Supabase PostgreSQL",
              "request": {
                "method": "POST",
                "header": [
                  { "key": "x-database-selection", "value": "supabase" },
                  { "key": "Content-Type", "value": "application/json" }
                ],
                "body": {
                  "mode": "raw",
                  "raw": json.dumps({
                    "portfolioId": "PORT-ALPACA-01",
                    "broker": "ALPACA",
                    "symbol": "AAPL",
                    "spotPrice": 343.39,
                    "sharesCount": 100,
                    "putStrike": 310,
                    "callStrike": 360,
                    "putPremium": 2.03,
                    "callPremium": 2.51,
                    "expirationDate": "2026-10-16T00:00:00.000Z"
                  }, indent=2),
                  "options": { "raw": { "language": "json" } }
                },
                "url": make_url("hedging/collar-spread")
              },
              "response": []
            },
            {
              "name": "9_AutomaticoAlpaca (Zero-Cost Auto-Collar)",
              "request": {
                "method": "POST",
                "header": [
                  { "key": "x-database-selection", "value": "supabase" },
                  { "key": "x-broker-selection", "value": "ALPACA" },
                  { "key": "Content-Type", "value": "application/json" }
                ],
                "body": {
                  "mode": "raw",
                  "raw": json.dumps({
                    "symbol": "AAPL",
                    "sharesCount": 100,
                    "portfolioId": "PORT-AUTO-ALPACA",
                    "broker": "ALPACA",
                    "expirationDate": "2026-10-16",
                    "executeOrders": True
                  }, indent=2),
                  "options": { "raw": { "language": "json" } }
                },
                "url": make_url("hedging/auto-collar")
              },
              "response": []
            }
          ]
        },
        {
          "name": "TutorialInteractiveBrokers",
          "item": [
            {
              "name": "0_Consultar Balance y Cuenta en Interactive Brokers (DUR303142)",
              "request": {
                "method": "GET",
                "header": [
                  { "key": "x-broker-selection", "value": "IBKR" }
                ],
                "url": make_url("broker/account", [{"key": "broker", "value": "IBKR"}])
              },
              "response": []
            },
            {
              "name": "0_Consultar Posiciones Abiertas en Interactive Brokers",
              "request": {
                "method": "GET",
                "header": [
                  { "key": "x-broker-selection", "value": "IBKR" }
                ],
                "url": make_url("broker/positions", [{"key": "broker", "value": "IBKR"}])
              },
              "response": []
            },
            {
              "name": "1_Consultar Cotización Spot en Interactive Brokers (TWS Socket)",
              "request": {
                "method": "GET",
                "header": [
                  { "key": "x-broker-selection", "value": "IBKR" }
                ],
                "url": make_url("broker/quote/AAPL")
              },
              "response": []
            },
            {
              "name": "2_Consultar la Cadena de Opciones en Interactive Brokers",
              "request": {
                "method": "GET",
                "header": [
                  { "key": "x-broker-selection", "value": "IBKR" }
                ],
                "url": make_url("broker/options-chain/AAPL", [{"key": "expiration", "value": "2026-10-16"}])
              },
              "response": []
            },
            {
              "name": "3_Recomendar y Valuar la Opción Put Protectora Óptima (F0) IBKR",
              "request": {
                "method": "GET",
                "header": [
                  { "key": "x-broker-selection", "value": "IBKR" }
                ],
                "url": make_url("hedging/recommend-option/AAPL", [
                  {"key": "type", "value": "PUT"},
                  {"key": "broker", "value": "IBKR"},
                  {"key": "moneyness", "value": "OTM"}
                ])
              },
              "response": []
            },
            {
              "name": "4_Recomendar y Valuar la Opción Call Financiadora Óptima (F0) IBKR",
              "request": {
                "method": "GET",
                "header": [
                  { "key": "x-broker-selection", "value": "IBKR" }
                ],
                "url": make_url("hedging/recommend-option/AAPL", [
                  {"key": "type", "value": "CALL"},
                  {"key": "broker", "value": "IBKR"},
                  {"key": "moneyness", "value": "OTM"}
                ])
              },
              "response": []
            },
            {
              "name": "5_Emitir Orden de Compra de Acciones en IBKR",
              "request": {
                "method": "POST",
                "header": [
                  { "key": "x-broker-selection", "value": "IBKR" },
                  { "key": "Content-Type", "value": "application/json" }
                ],
                "body": {
                  "mode": "raw",
                  "raw": json.dumps({
                    "symbol": "AAPL",
                    "qty": 100,
                    "side": "buy",
                    "type": "limit",
                    "limitPrice": 345.00,
                    "timeInForce": "DAY"
                  }, indent=2),
                  "options": { "raw": { "language": "json" } }
                },
                "url": make_url("broker/orders")
              },
              "response": []
            },
            {
              "name": "6_Emitir Orden de Compra del Put Protector en IBKR (Simbología OCC)",
              "request": {
                "method": "POST",
                "header": [
                  { "key": "x-broker-selection", "value": "IBKR" },
                  { "key": "Content-Type", "value": "application/json" }
                ],
                "body": {
                  "mode": "raw",
                  "raw": json.dumps({
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
                    "timeInForce": "DAY"
                  }, indent=2),
                  "options": { "raw": { "language": "json" } }
                },
                "url": make_url("broker/orders")
              },
              "response": []
            },
            {
              "name": "7_Emitir Orden de Venta del Short Call en IBKR (Mitigación Covered Automática)",
              "request": {
                "method": "POST",
                "header": [
                  { "key": "x-broker-selection", "value": "IBKR" },
                  { "key": "Content-Type", "value": "application/json" }
                ],
                "body": {
                  "mode": "raw",
                  "raw": json.dumps({
                    "symbol": "AAPL",
                    "contractSymbol": "AAPL261016C00360000",
                    "instrumentType": "OPTION",
                    "optionType": "CALL",
                    "strikePrice": 360,
                    "expirationDate": "2026-10-16",
                    "qty": 1,
                    "side": "sell",
                    "type": "limit",
                    "limitPrice": 2.50,
                    "timeInForce": "DAY"
                  }, indent=2),
                  "options": { "raw": { "language": "json" } }
                },
                "url": make_url("broker/orders")
              },
              "response": []
            },
            {
              "name": "8_Estructurar y Persistir la Cobertura en Supabase PostgreSQL (IBKR)",
              "request": {
                "method": "POST",
                "header": [
                  { "key": "x-database-selection", "value": "supabase" },
                  { "key": "Content-Type", "value": "application/json" }
                ],
                "body": {
                  "mode": "raw",
                  "raw": json.dumps({
                    "portfolioId": "PORT-IBKR-01",
                    "broker": "IBKR",
                    "symbol": "AAPL",
                    "spotPrice": 343.39,
                    "sharesCount": 100,
                    "putStrike": 310,
                    "callStrike": 360,
                    "putPremium": 2.03,
                    "callPremium": 2.51,
                    "expirationDate": "2026-10-16T00:00:00.000Z"
                  }, indent=2),
                  "options": { "raw": { "language": "json" } }
                },
                "url": make_url("hedging/collar-spread")
              },
              "response": []
            },
            {
              "name": "9_AutomáticoIBKR (Zero-Cost Auto-Collar)",
              "request": {
                "method": "POST",
                "header": [
                  { "key": "x-database-selection", "value": "supabase" },
                  { "key": "x-broker-selection", "value": "IBKR" },
                  { "key": "Content-Type", "value": "application/json" }
                ],
                "body": {
                  "mode": "raw",
                  "raw": json.dumps({
                    "symbol": "AAPL",
                    "sharesCount": 100,
                    "portfolioId": "PORT-AUTO-IBKR",
                    "broker": "IBKR",
                    "expirationDate": "2026-10-16",
                    "executeOrders": True
                  }, indent=2),
                  "options": { "raw": { "language": "json" } }
                },
                "url": make_url("hedging/auto-collar")
              },
              "response": []
            }
          ]
        },
        {
          "name": "SincronizarUnderlying",
          "request": {
            "method": "POST",
            "header": [
              { "key": "x-database-selection", "value": "mongodb" },
              { "key": "x-broker-selection", "value": "WEBULL" }
            ],
            "url": make_url("broker/sync-underlying/MSFT", [
              {"key": "x-database-selection", "value": "mongodb"},
              {"key": "x-broker-selection", "value": "WEBULL"}
            ])
          },
          "response": []
        },
        {
          "name": "ConsultarTodasLasOrdenes",
          "request": {
            "method": "GET",
            "header": [
              { "key": "x-broker-selection", "value": "WEBULL" }
            ],
            "url": make_url("broker/orders", [
              {"key": "status", "value": "all"},
              {"key": "broker", "value": "WEBULL"}
            ])
          },
          "response": []
        },
        {
          "name": "BorrarUnaOrdenPendiente",
          "request": {
            "method": "DELETE",
            "header": [
              { "key": "x-broker-selection", "value": "WEBULL" }
            ],
            "url": make_url("broker/orders/b058af6bc909445781016e62e3a98c06")
          },
          "response": []
        },
        {
          "name": "Actualizar precio spot o volatilidad del subyacente",
          "request": {
            "method": "PUT",
            "header": [
              { "key": "Content-Type", "value": "application/json" },
              { "key": "x-database-selection", "value": "mongodb" }
            ],
            "body": {
              "mode": "raw",
              "raw": json.dumps({
                "spotPrice": 343.39,
                "volatility": 0.22
              }, indent=2),
              "options": { "raw": { "language": "json" } }
            },
            "url": make_url("underlyings/UND-AAPL-485f")
          },
          "response": []
        }
      ]
    }
  ]
}

out_paths = [
    r"c:\GitHub\FIC-generator\LSW-EQ1-PROYECTO\LSW_Cloudflare_Postman_Collection.json",
    r"c:\GitHub\FIC-generator\U2Act2\LSW_Cloudflare_Postman_Collection.json",
    r"c:\GitHub\FIC-generator\LSW_Cloudflare_Postman_Collection.json",
    r"C:\Users\ealta\.gemini\antigravity\brain\dc48f4da-e1e3-43d9-81ea-99f87e476809\LSW_Cloudflare_Postman_Collection.json"
]

for p in out_paths:
    with open(p, "w", encoding="utf-8") as f:
        json.dump(collection, f, indent=2, ensure_ascii=False)
    print(f"Colección guardada en: {p}")

