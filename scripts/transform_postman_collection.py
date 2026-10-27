import json

raw_json = """{
  "info": {
    "_postman_id": "29bd2619-9d1e-4c01-b368-90f726381b41",
    "name": "LSW (Cloudflare Tunnel - Equipo 1)",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    "_exporter_id": "56652918"
  },
  "item": [
    {
      "name": "U1",
      "item": [
        {
          "name": "GET_List ProdServ",
          "request": {
            "method": "GET",
            "header": [],
            "url": {
              "raw": "http://localhost:3020/api/v1/prod-serv",
              "protocol": "http",
              "host": [
                "localhost"
              ],
              "port": "3020",
              "path": [
                "api",
                "v1",
                "prod-serv"
              ]
            }
          },
          "response": []
        },
        {
          "name": "GET_Item ProdServ",
          "request": {
            "method": "GET",
            "header": []
          },
          "response": []
        },
        {
          "name": "New Request",
          "request": {
            "method": "GET",
            "header": []
          },
          "response": []
        }
      ]
    },
    {
      "name": "PROYECTO",
      "item": [
        {
          "name": "TutorialWebull",
          "item": [
            {
              "name": "1_Consultar Cotización Spot en Tiempo Real de Webull",
              "request": {
                "method": "GET",
                "header": [
                  {
                    "key": "x-broker-selection",
                    "value": "ALPACA",
                    "disabled": true
                  },
                  {
                    "key": "x-broker-selection",
                    "value": "WEBULL"
                  }
                ],
                "url": {
                  "raw": "http://localhost:3050/api/v1/broker/quote/NVDA",
                  "protocol": "http",
                  "host": [
                    "localhost"
                  ],
                  "port": "3050",
                  "path": [
                    "api",
                    "v1",
                    "broker",
                    "quote",
                    "NVDA"
                  ]
                }
              },
              "response": []
            },
            {
              "name": "2_Consultar la Cadena de Opciones en Alpaca Copy",
              "request": {
                "method": "GET",
                "header": [
                  {
                    "key": "x-broker-selection",
                    "value": "WEBULL"
                  }
                ],
                "url": {
                  "raw": "http://localhost:3050/api/v1/broker/options-chain/NVDA?expiration=2026-10-16",
                  "protocol": "http",
                  "host": [
                    "localhost"
                  ],
                  "port": "3050",
                  "path": [
                    "api",
                    "v1",
                    "broker",
                    "options-chain",
                    "NVDA"
                  ],
                  "query": [
                    {
                      "key": "expiration",
                      "value": "2026-10-16"
                    }
                  ]
                }
              },
              "response": []
            },
            {
              "name": "3_Recomendar y Valuar la Opción Put Protectora Óptima (F0) Copy",
              "request": {
                "method": "GET",
                "header": [
                  {
                    "key": "x-broker-selection",
                    "value": "WEBULL"
                  }
                ],
                "url": {
                  "raw": "http://localhost:3050/api/v1/hedging/recommend-option/NVDA?type=PUT&broker=WEBULL&moneyness=OTM",
                  "protocol": "http",
                  "host": [
                    "localhost"
                  ],
                  "port": "3050",
                  "path": [
                    "api",
                    "v1",
                    "hedging",
                    "recommend-option",
                    "NVDA"
                  ],
                  "query": [
                    {
                      "key": "type",
                      "value": "PUT"
                    },
                    {
                      "key": "broker",
                      "value": "WEBULL"
                    },
                    {
                      "key": "moneyness",
                      "value": "OTM"
                    }
                  ]
                }
              },
              "response": []
            },
            {
              "name": "4_Recomendar y Valuar la Opción Call Financiadora Óptima (F0) Copy",
              "request": {
                "method": "GET",
                "header": [],
                "url": {
                  "raw": "http://localhost:3050/api/v1/hedging/recommend-option/NVDA?type=CALL&broker=WEBULL&moneyness=OTM",
                  "protocol": "http",
                  "host": [
                    "localhost"
                  ],
                  "port": "3050",
                  "path": [
                    "api",
                    "v1",
                    "hedging",
                    "recommend-option",
                    "NVDA"
                  ],
                  "query": [
                    {
                      "key": "type",
                      "value": "CALL"
                    },
                    {
                      "key": "broker",
                      "value": "WEBULL"
                    },
                    {
                      "key": "moneyness",
                      "value": "OTM"
                    }
                  ]
                }
              },
              "response": []
            },
            {
              "name": "5_Emitir Orden de Compra de Acciones en Alpaca Copy",
              "request": {
                "method": "POST",
                "header": [
                  {
                    "key": "x-broker-selection",
                    "value": "ALPACA",
                    "disabled": true
                  },
                  {
                    "key": "x-broker-selection",
                    "value": "WEBULL"
                  },
                  {
                    "key": "Content-Type",
                    "value": "application/json"
                  }
                ],
                "body": {
                  "mode": "raw",
                  "raw": "{\\r\\n  \\\"symbol\\\": \\\"NVDA\\\",\\r\\n  \\\"qty\\\": 10,\\r\\n  \\\"side\\\": \\\"buy\\\",\\r\\n  \\\"type\\\": \\\"limit\\\",\\r\\n  \\\"limitPrice\\\": 221.30,\\r\\n  \\\"timeInForce\\\": \\\"day\\\"\\r\\n}",
                  "options": {
                    "raw": {
                      "language": "json"
                    }
                  }
                },
                "url": {
                  "raw": "http://localhost:3050/api/v1/broker/orders",
                  "protocol": "http",
                  "host": [
                    "localhost"
                  ],
                  "port": "3050",
                  "path": [
                    "api",
                    "v1",
                    "broker",
                    "orders"
                  ]
                }
              },
              "response": []
            },
            {
              "name": "6_Emitir Orden de Compra del Put Protector en Alpaca (Simbología OCC) Copy",
              "request": {
                "method": "POST",
                "header": [
                  {
                    "key": "x-broker-selection",
                    "value": "ALPACA",
                    "disabled": true
                  },
                  {
                    "key": "x-broker-selection",
                    "value": "WEBULL"
                  },
                  {
                    "key": "Content-Type",
                    "value": "application/json"
                  }
                ],
                "body": {
                  "mode": "raw",
                  "raw": "{\\r\\n  \\\"symbol\\\": \\\"NVDA\\\",\\r\\n  \\\"contractSymbol\\\": \\\"NVDA261016P00195000\\\",\\r\\n  \\\"instrumentType\\\": \\\"OPTION\\\",\\r\\n  \\\"optionType\\\": \\\"PUT\\\",\\r\\n  \\\"strikePrice\\\": 195,\\r\\n  \\\"expirationDate\\\": \\\"2026-10-16\\\",\\r\\n  \\\"qty\\\": 1,\\r\\n  \\\"side\\\": \\\"buy\\\",\\r\\n  \\\"type\\\": \\\"limit\\\",\\r\\n  \\\"limitPrice\\\": 2.54,\\r\\n  \\\"timeInForce\\\": \\\"gtc\\\"\\r\\n}",
                  "options": {
                    "raw": {
                      "language": "json"
                    }
                  }
                },
                "url": {
                  "raw": "http://localhost:3050/api/v1/broker/orders",
                  "protocol": "http",
                  "host": [
                    "localhost"
                  ],
                  "port": "3050",
                  "path": [
                    "api",
                    "v1",
                    "broker",
                    "orders"
                  ]
                }
              },
              "response": []
            },
            {
              "name": "7_Emitir Orden de Venta del Short Call en Alpaca (Simbología OCC) Copy",
              "request": {
                "method": "POST",
                "header": [
                  {
                    "key": "x-broker-selection",
                    "value": "ALPACA",
                    "disabled": true
                  },
                  {
                    "key": "x-broker-selection",
                    "value": "WEBULL"
                  },
                  {
                    "key": "Content-Type",
                    "value": "application/json"
                  }
                ],
                "body": {
                  "mode": "raw",
                  "raw": "{\\r\\n  \\\"symbol\\\": \\\"NVDA\\\",\\r\\n  \\\"contractSymbol\\\": \\\"NVDA261016C00230000\\\",\\r\\n  \\\"instrumentType\\\": \\\"OPTION\\\",\\r\\n  \\\"optionType\\\": \\\"CALL\\\",\\r\\n  \\\"strikePrice\\\": 230,\\r\\n  \\\"stockPrice\\\": 221.30,\\r\\n  \\\"expirationDate\\\": \\\"2026-10-16\\\",\\r\\n  \\\"qty\\\": 1,\\r\\n  \\\"side\\\": \\\"sell\\\",\\r\\n  \\\"type\\\": \\\"limit\\\",\\r\\n  \\\"limitPrice\\\": 1.8,\\r\\n  \\\"timeInForce\\\": \\\"gtc\\\"\\r\\n}",
                  "options": {
                    "raw": {
                      "language": "json"
                    }
                  }
                },
                "url": {
                  "raw": "http://localhost:3050/api/v1/broker/orders",
                  "protocol": "http",
                  "host": [
                    "localhost"
                  ],
                  "port": "3050",
                  "path": [
                    "api",
                    "v1",
                    "broker",
                    "orders"
                  ]
                }
              },
              "response": []
            },
            {
              "name": "8_Estructurar y Persistir la Cobertura en Supabase PostgreSQL Copy",
              "request": {
                "method": "POST",
                "header": [
                  {
                    "key": "x-database-selection",
                    "value": "mongodb"
                  },
                  {
                    "key": "Content-Type",
                    "value": "application/json"
                  }
                ],
                "body": {
                  "mode": "raw",
                  "raw": "{\\r\\n  \\\"portfolioId\\\": \\\"PORT-WEBULL-01\\\",\\r\\n  \\\"broker\\\": \\\"WEBULL\\\",\\r\\n  \\\"symbol\\\": \\\"NVDA\\\",\\r\\n  \\\"spotPrice\\\": 221.30,\\r\\n  \\\"sharesCount\\\": 5,\\r\\n  \\\"putStrike\\\": 200,\\r\\n  \\\"callStrike\\\": 245,\\r\\n  \\\"putPremium\\\": 2.54,\\r\\n  \\\"callPremium\\\": 2.87,\\r\\n  \\\"expirationDate\\\": \\\"2026-10-16T00:00:00.000Z\\\"\\r\\n}",
                  "options": {
                    "raw": {
                      "language": "json"
                    }
                  }
                },
                "url": {
                  "raw": "http://localhost:3050/api/v1/hedging/collar-spread",
                  "protocol": "http",
                  "host": [
                    "localhost"
                  ],
                  "port": "3050",
                  "path": [
                    "api",
                    "v1",
                    "hedging",
                    "collar-spread"
                  ]
                }
              },
              "response": []
            },
            {
              "name": "9_AutomáticoWebull",
              "request": {
                "method": "POST",
                "header": [
                  {
                    "key": "x-database-selection",
                    "value": "mongodb"
                  },
                  {
                    "key": "Content-Type",
                    "value": "application/json"
                  },
                  {
                    "key": "x-broker-selection",
                    "value": "WEBULL"
                  }
                ],
                "body": {
                  "mode": "raw",
                  "raw": "{\\r\\n  \\\"symbol\\\": \\\"NVDA\\\",\\r\\n  \\\"sharesCount\\\": 100,\\r\\n  \\\"portfolioId\\\": \\\"PORT-AUTO-WEBULL\\\",\\r\\n  \\\"broker\\\": \\\"WEBULL\\\",\\r\\n  \\\"expirationDate\\\": \\\"2026-10-16\\\",\\r\\n  \\\"executeOrders\\\": true\\r\\n}",
                  "options": {
                    "raw": {
                      "language": "json"
                    }
                  }
                },
                "url": {
                  "raw": "http://localhost:3050/api/v1/hedging/auto-collar",
                  "protocol": "http",
                  "host": [
                    "localhost"
                  ],
                  "port": "3050",
                  "path": [
                    "api",
                    "v1",
                    "hedging",
                    "auto-collar"
                  ]
                }
              },
              "response": []
            }
          ]
        },
        {
          "name": "TutorialAlpaca",
          "item": [
            {
              "name": "1_Consultar Cotización Spot en Alpaca (IEX Feed)",
              "request": {
                "method": "GET",
                "header": [
                  {
                    "key": "x-broker-selection",
                    "value": "ALPACA"
                  },
                  {
                    "key": "x-broker-selection",
                    "value": "WEBULL",
                    "disabled": true
                  }
                ],
                "url": {
                  "raw": "http://localhost:3050/api/v1/broker/quote/AAPL",
                  "protocol": "http",
                  "host": [
                    "localhost"
                  ],
                  "port": "3050",
                  "path": [
                    "api",
                    "v1",
                    "broker",
                    "quote",
                    "AAPL"
                  ]
                }
              },
              "response": []
            },
            {
              "name": "2_Consultar la Cadena de Opciones en Alpaca",
              "request": {
                "method": "GET",
                "header": [
                  {
                    "key": "x-broker-selection",
                    "value": "ALPACA"
                  },
                  {
                    "key": "x-broker-selection",
                    "value": "WEBULL",
                    "disabled": true
                  }
                ],
                "url": {
                  "raw": "http://localhost:3050/api/v1/broker/options-chain/AAPL?expiration=2026-10-16",
                  "protocol": "http",
                  "host": [
                    "localhost"
                  ],
                  "port": "3050",
                  "path": [
                    "api",
                    "v1",
                    "broker",
                    "options-chain",
                    "AAPL"
                  ],
                  "query": [
                    {
                      "key": "expiration",
                      "value": "2026-10-16"
                    }
                  ]
                }
              },
              "response": []
            },
            {
              "name": "3_Recomendar y Valuar la Opción Put Protectora Óptima (F0)",
              "request": {
                "method": "GET",
                "header": [
                  {
                    "key": "x-broker-selection",
                    "value": "ALPACA"
                  },
                  {
                    "key": "x-broker-selection",
                    "value": "WEBULL",
                    "disabled": true
                  }
                ],
                "url": {
                  "raw": "http://localhost:3050/api/v1/hedging/recommend-option/AAPL?type=PUT&broker=ALPACA&moneyness=OTM",
                  "protocol": "http",
                  "host": [
                    "localhost"
                  ],
                  "port": "3050",
                  "path": [
                    "api",
                    "v1",
                    "hedging",
                    "recommend-option",
                    "AAPL"
                  ],
                  "query": [
                    {
                      "key": "type",
                      "value": "PUT"
                    },
                    {
                      "key": "broker",
                      "value": "ALPACA"
                    },
                    {
                      "key": "moneyness",
                      "value": "OTM"
                    }
                  ]
                }
              },
              "response": []
            },
            {
              "name": "4_Recomendar y Valuar la Opción Call Financiadora Óptima (F0)",
              "request": {
                "method": "GET",
                "header": [
                  {
                    "key": "x-broker-selection",
                    "value": "ALPACA"
                  },
                  {
                    "key": "x-broker-selection",
                    "value": "WEBULL",
                    "disabled": true
                  }
                ],
                "url": {
                  "raw": "http://localhost:3050/api/v1/hedging/recommend-option/AAPL?type=CALL&broker=ALPACA&moneyness=OTM",
                  "protocol": "http",
                  "host": [
                    "localhost"
                  ],
                  "port": "3050",
                  "path": [
                    "api",
                    "v1",
                    "hedging",
                    "recommend-option",
                    "AAPL"
                  ],
                  "query": [
                    {
                      "key": "type",
                      "value": "CALL"
                    },
                    {
                      "key": "broker",
                      "value": "ALPACA"
                    },
                    {
                      "key": "moneyness",
                      "value": "OTM"
                    }
                  ]
                }
              },
              "response": []
            },
            {
              "name": "5_Emitir Orden de Compra de Acciones en Alpaca",
              "request": {
                "method": "POST",
                "header": [
                  {
                    "key": "x-broker-selection",
                    "value": "ALPACA"
                  },
                  {
                    "key": "x-broker-selection",
                    "value": "WEBULL",
                    "disabled": true
                  },
                  {
                    "key": "Content-Type",
                    "value": "application/json"
                  }
                ],
                "body": {
                  "mode": "raw",
                  "raw": "{\\r\\n  \\\"symbol\\\": \\\"AAPL\\\",\\r\\n  \\\"qty\\\": 300,\\r\\n  \\\"side\\\": \\\"buy\\\",\\r\\n  \\\"type\\\": \\\"limit\\\",\\r\\n  \\\"limitPrice\\\": 400,\\r\\n  \\\"timeInForce\\\": \\\"day\\\"\\r\\n}",
                  "options": {
                    "raw": {
                      "language": "json"
                    }
                  }
                },
                "url": {
                  "raw": "http://localhost:3050/api/v1/broker/orders",
                  "protocol": "http",
                  "host": [
                    "localhost"
                  ],
                  "port": "3050",
                  "path": [
                    "api",
                    "v1",
                    "broker",
                    "orders"
                  ]
                }
              },
              "response": []
            },
            {
              "name": "6_Emitir Orden de Compra del Put Protector en Alpaca (Simbología OCC)",
              "request": {
                "method": "POST",
                "header": [
                  {
                    "key": "x-broker-selection",
                    "value": "ALPACA"
                  },
                  {
                    "key": "x-broker-selection",
                    "value": "WEBULL",
                    "disabled": true
                  },
                  {
                    "key": "Content-Type",
                    "value": "application/json"
                  }
                ],
                "body": {
                  "mode": "raw",
                  "raw": "{\\r\\n  \\\"symbol\\\": \\\"AAPL261016P00310000\\\",\\r\\n  \\\"qty\\\": 1,\\r\\n  \\\"side\\\": \\\"buy\\\",\\r\\n  \\\"type\\\": \\\"limit\\\",\\r\\n  \\\"limitPrice\\\": 2.44,\\r\\n  \\\"timeInForce\\\": \\\"day\\\"\\r\\n}",
                  "options": {
                    "raw": {
                      "language": "json"
                    }
                  }
                },
                "url": {
                  "raw": "http://localhost:3050/api/v1/broker/orders",
                  "protocol": "http",
                  "host": [
                    "localhost"
                  ],
                  "port": "3050",
                  "path": [
                    "api",
                    "v1",
                    "broker",
                    "orders"
                  ]
                }
              },
              "response": []
            },
            {
              "name": "7_Emitir Orden de Venta del Short Call en Alpaca (Simbología OCC)",
              "request": {
                "method": "POST",
                "header": [
                  {
                    "key": "x-broker-selection",
                    "value": "ALPACA"
                  },
                  {
                    "key": "x-broker-selection",
                    "value": "WEBULL",
                    "disabled": true
                  },
                  {
                    "key": "Content-Type",
                    "value": "application/json"
                  }
                ],
                "body": {
                  "mode": "raw",
                  "raw": "{\\r\\n  \\\"symbol\\\": \\\"AAPL261016C00360000\\\",\\r\\n  \\\"qty\\\": 1,\\r\\n  \\\"side\\\": \\\"sell\\\",\\r\\n  \\\"type\\\": \\\"limit\\\",\\r\\n  \\\"limitPrice\\\": 2.82,\\r\\n  \\\"timeInForce\\\": \\\"day\\\"\\r\\n}",
                  "options": {
                    "raw": {
                      "language": "json"
                    }
                  }
                },
                "url": {
                  "raw": "http://localhost:3050/api/v1/broker/orders",
                  "protocol": "http",
                  "host": [
                    "localhost"
                  ],
                  "port": "3050",
                  "path": [
                    "api",
                    "v1",
                    "broker",
                    "orders"
                  ]
                }
              },
              "response": []
            },
            {
              "name": "8_Estructurar y Persistir la Cobertura en Supabase PostgreSQL",
              "request": {
                "method": "POST",
                "header": [
                  {
                    "key": "x-database-selection",
                    "value": "supabase"
                  },
                  {
                    "key": "Content-Type",
                    "value": "application/json"
                  }
                ],
                "body": {
                  "mode": "raw",
                  "raw": "{\\r\\n  \\\"portfolioId\\\": \\\"PORT-ALPACA-01\\\",\\r\\n  \\\"broker\\\": \\\"ALPACA\\\",\\r\\n  \\\"symbol\\\": \\\"AAPL\\\",\\r\\n  \\\"spotPrice\\\": 342.52,\\r\\n  \\\"sharesCount\\\": 10,\\r\\n  \\\"putStrike\\\": 310,\\r\\n  \\\"callStrike\\\": 360,\\r\\n  \\\"putPremium\\\": 2.09,\\r\\n  \\\"callPremium\\\": 2.46,\\r\\n  \\\"expirationDate\\\": \\\"2026-10-16T00:00:00.000Z\\\"\\r\\n}",
                  "options": {
                    "raw": {
                      "language": "json"
                    }
                  }
                },
                "url": {
                  "raw": "http://localhost:3050/api/v1/hedging/collar-spread",
                  "protocol": "http",
                  "host": [
                    "localhost"
                  ],
                  "port": "3050",
                  "path": [
                    "api",
                    "v1",
                    "hedging",
                    "collar-spread"
                  ]
                }
              },
              "response": []
            },
            {
              "name": "9_AutomaticoAlpaca",
              "request": {
                "method": "POST",
                "header": [
                  {
                    "key": "x-database-selection",
                    "value": "supabase"
                  },
                  {
                    "key": "Content-Type",
                    "value": "application/json"
                  },
                  {
                    "key": "x-broker-selection",
                    "value": "ALPACA"
                  }
                ],
                "body": {
                  "mode": "raw",
                  "raw": "{\\r\\n  \\\"symbol\\\": \\\"AAPL\\\",\\r\\n  \\\"sharesCount\\\": 100,\\r\\n  \\\"portfolioId\\\": \\\"PORT-AUTO-ALPACA\\\",\\r\\n  \\\"broker\\\": \\\"ALPACA\\\",\\r\\n  \\\"expirationDate\\\": \\\"2026-10-16\\\",\\r\\n  \\\"executeOrders\\\": true\\r\\n}",
                  "options": {
                    "raw": {
                      "language": "json"
                    }
                  }
                },
                "url": {
                  "raw": "http://localhost:3050/api/v1/hedging/auto-collar",
                  "protocol": "http",
                  "host": [
                    "localhost"
                  ],
                  "port": "3050",
                  "path": [
                    "api",
                    "v1",
                    "hedging",
                    "auto-collar"
                  ]
                }
              },
              "response": []
            }
          ]
        },
        {
          "name": "SincronizarUnderlying",
          "request": {
            "method": "POST",
            "header": [],
            "url": {
              "raw": "http://localhost:3050/api/v1/broker/sync-underlying/MSFT?x-database-selection=mongodb&x-broker-selection=WEBULL",
              "protocol": "http",
              "host": [
                "localhost"
              ],
              "port": "3050",
              "path": [
                "api",
                "v1",
                "broker",
                "sync-underlying",
                "MSFT"
              ],
              "query": [
                {
                  "key": "x-database-selection",
                  "value": "mongodb"
                },
                {
                  "key": "x-broker-selection",
                  "value": "WEBULL"
                }
              ]
            }
          },
          "response": []
        },
        {
          "name": "ConsultarTodasLasOrdenes",
          "request": {
            "method": "GET",
            "header": [],
            "url": {
              "raw": "http://localhost:3050/api/v1/broker/orders?status=all&broker=WEBULL",
              "protocol": "http",
              "host": [
                "localhost"
              ],
              "port": "3050",
              "path": [
                "api",
                "v1",
                "broker",
                "orders"
              ],
              "query": [
                {
                  "key": "status",
                  "value": "all"
                },
                {
                  "key": "broker",
                  "value": "WEBULL"
                }
              ]
            }
          },
          "response": []
        },
        {
          "name": "BorrarUnaOrdenPendiente",
          "request": {
            "method": "DELETE",
            "header": [
              {
                "key": "x-broker-selection",
                "value": "WEBULL"
              }
            ],
            "url": {
              "raw": "http://localhost:3050/api/v1/broker/orders/b058af6bc909445781016e62e3a98c06",
              "protocol": "http",
              "host": [
                "localhost"
              ],
              "port": "3050",
              "path": [
                "api",
                "v1",
                "broker",
                "orders",
                "b058af6bc909445781016e62e3a98c06"
              ]
            }
          },
          "response": []
        },
        {
          "name": "Actualizar precio spot o volatilidad del subyacente",
          "request": {
            "method": "PUT",
            "header": [
              {
                "key": "content-type",
                "value": "application/json"
              },
              {
                "key": "x-database-selection",
                "value": "mongodb"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\\r\\n  \\\"spotPrice\\\": 335.87,\\r\\n  \\\"volatility\\\": 0.2\\r\\n}",
              "options": {
                "raw": {
                  "language": "json"
                }
              }
            },
            "url": {
              "raw": "http://localhost:3050/api/v1/underlyings/UND-AAPL-485f",
              "protocol": "http",
              "host": [
                "localhost"
              ],
              "port": "3050",
              "path": [
                "api",
                "v1",
                "underlyings",
                "UND-AAPL-485f"
              ]
            }
          },
          "response": []
        }
      ]
    }
  ]
}"""

data = json.loads(raw_json)

# Función recursiva para transformar URLs
TUNNEL_URL = "https://spots-varying-chi-estate.trycloudflare.com"
HOST_PARTS = ["spots-varying-chi-estate", "trycloudflare", "com"]

def transform_item(item):
    if "item" in item:
        for sub in item["item"]:
            transform_item(sub)
    elif "request" in item:
        req = item["request"]
        if "url" in req and isinstance(req["url"], dict):
            url_obj = req["url"]
            raw = url_obj.get("raw", "")
            if "localhost:3050" in raw:
                # 1. Reemplazar raw
                url_obj["raw"] = raw.replace("http://localhost:3050", TUNNEL_URL)
                # 2. Protocolo a https
                url_obj["protocol"] = "https"
                # 3. Host a partes de Cloudflare
                url_obj["host"] = HOST_PARTS
                # 4. Eliminar puerto 3050
                if "port" in url_obj:
                    del url_obj["port"]
                    
        # Limpiar headers (ej: quitar espacios raros)
        if "header" in req and isinstance(req["header"], list):
            for h in req["header"]:
                if "value" in h and isinstance(h["value"], str):
                    h["value"] = h["value"].strip()

for it in data["item"]:
    transform_item(it)

output_path = r"c:\GitHub\FIC-generator\LSW-EQ1-PROYECTO\LSW_Cloudflare_Postman_Collection.json"
with open(output_path, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print(f"Archivo exportado exitosamente a: {output_path}")

