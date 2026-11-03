import fs from 'fs';
import yaml from 'yamljs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const specPath = path.join(__dirname, '../spec/openspec.yaml');
let content = fs.readFileSync(specPath, 'utf8');

const componentsSection = `components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: Token Bearer JWT emitido en /auth/login con claims de usuario, rol y motor de base de datos activa (dbTarget).

  schemas:
    UnderlyingInput:
      type: object
      required: [symbol, companyName, spotPrice]
      properties:
        symbol: { type: string, example: NVDA }
        companyName: { type: string, example: NVIDIA Corporation }
        spotPrice: { type: number, example: 125.80 }
        volatility: { type: number, example: 0.45 }

    Underlying:
      type: object
      required: [symbol, companyName, spotPrice, volatility]
      properties:
        id: { type: string, example: '67035ab218ef8c12e4f09999' }
        symbol: { type: string, example: AAPL }
        companyName: { type: string, example: Apple Inc. }
        spotPrice: { type: number, example: 228.52 }
        volatility: { type: number, example: 0.2450 }
        createdAt: { type: string, format: date-time, example: '2026-10-10T12:00:00Z' }
        updatedAt: { type: string, format: date-time, example: '2026-10-10T14:30:00Z' }

    LegInput:
      type: object
      required: [legRole, assetType, quantity, entryPrice]
      properties:
        legRole: { type: string, enum: [UNDERLYING, HEDGE_FLOOR, FINANCE_CEILING, STOCK, LONG_PUT, SHORT_CALL], example: HEDGE_FLOOR }
        assetType: { type: string, enum: [EQUITY, OPTION], example: OPTION }
        optionType: { type: string, enum: [CALL, PUT, null], example: PUT }
        strike: { type: number, example: 220.0 }
        quantity: { type: integer, example: 1 }
        entryPrice: { type: number, example: 4.20 }

    OptionLeg:
      type: object
      required: [legId, legRole, assetType, quantity, entryPrice]
      properties:
        legId: { type: string, example: 'LEG-PUT-FLOOR-01' }
        legRole:
          type: string
          enum: [UNDERLYING, HEDGE_FLOOR, FINANCE_CEILING, STOCK, LONG_PUT, SHORT_CALL]
          example: HEDGE_FLOOR
        assetType:
          type: string
          enum: [EQUITY, OPTION]
          example: OPTION
        contractSymbol: { type: string, example: 'NVDA261016P00119500' }
        optionType:
          type: string
          enum: [CALL, PUT, null]
          example: PUT
        strike: { type: number, example: 119.50 }
        expirationDate: { type: string, format: date-time, example: '2026-10-16T00:00:00Z' }
        quantity: { type: integer, example: 1 }
        entryPrice: { type: number, example: 2.15 }
        delta: { type: number, example: -0.2105 }
        gamma: { type: number, example: 0.0340 }
        theta: { type: number, example: -0.0450 }
        vega: { type: number, example: 0.1250 }

    UnderlyingSubdocument:
      type: object
      required: [symbol, companyName, spotPriceAtEntry, sharesCount]
      properties:
        symbol: { type: string, example: NVDA }
        companyName: { type: string, example: NVIDIA Corporation }
        spotPriceAtEntry: { type: number, example: 125.80 }
        sharesCount: { type: integer, example: 100 }

    FinancialMetricsSubdocument:
      type: object
      required: [netDebitCredit, breakevenPrice, floorProtectionPrice, maxLossTotalUSD]
      properties:
        netDebitCredit: { type: number, example: 3.00, description: 'Crédito (+) o Débito (-) neto en USD de primas' }
        breakevenPrice: { type: number, example: 125.77, description: 'Precio de equilibrio a vencimiento' }
        floorProtectionPrice: { type: number, example: 119.50, description: 'Suelo mínimo blindado garantizado por el Put' }
        ceilingCapPrice: { type: number, example: 135.00, description: 'Techo máximo de ganancias fijado por el Short Call' }
        maxLossTotalUSD: { type: number, example: 627.00, description: 'Pérdida máxima acotada en USD' }
        maxProfitTotalUSD: { type: number, example: 923.00, description: 'Beneficio máximo acotado en USD' }
        netDelta: { type: number, example: 0.5655, description: 'Delta neta agregada de la posición cubierta' }

    HedgingStrategy:
      type: object
      required: [_id, portfolioId, broker, strategyType, status, underlying, legs, financialMetrics]
      properties:
        _id: { type: string, example: '67035ab218ef8c12e4f01234' }
        id: { type: string, example: '67035ab218ef8c12e4f01234' }
        portfolioId: { type: string, example: 'PORT-TECH-COLLAR-01' }
        broker:
          type: string
          enum: [ALPACA, IBKR, WEBULL, SIMULATED]
          default: ALPACA
          example: ALPACA
          description: Broker bursátil donde opera o se liquida la estrategia de cobertura
        strategyType:
          type: string
          enum: [PROTECTIVE_PUT, COLLAR, COLLAR_SPREAD]
          example: COLLAR
        status:
          type: string
          enum: [ACTIVE, CLOSED, EXPIRED, EXERCISED]
          default: ACTIVE
          example: ACTIVE
        underlying:
          $ref: '#/components/schemas/UnderlyingSubdocument'
        legs:
          type: array
          items:
            $ref: '#/components/schemas/OptionLeg'
        financialMetrics:
          $ref: '#/components/schemas/FinancialMetricsSubdocument'
        createdAt: { type: string, format: date-time, example: '2026-10-10T14:30:00Z' }
        updatedAt: { type: string, format: date-time, example: '2026-10-10T14:30:00Z' }

    BlackScholesInput:
      type: object
      required: [spotPrice, strikePrice, timeToExpirationYears, volatility, riskFreeRate, optionType]
      properties:
        spotPrice: { type: number, example: 228.50 }
        strikePrice: { type: number, example: 220.00 }
        timeToExpirationYears: { type: number, example: 0.0822 }
        volatility: { type: number, example: 0.25 }
        riskFreeRate: { type: number, example: 0.045 }
        optionType: { type: string, enum: [CALL, PUT], example: PUT }

    BlackScholesOutput:
      type: object
      properties:
        theoreticalPrice: { type: number, example: 2.15 }
        d1: { type: number, example: 0.6543 }
        d2: { type: number, example: 0.5824 }
        greeks:
          type: object
          properties:
            delta: { type: number, example: -0.2105 }
            gamma: { type: number, example: 0.0340 }
            theta: { type: number, example: -0.0450 }
            vega: { type: number, example: 0.1250 }
            rho: { type: number, example: -0.0150 }

    ImpliedVolatilityInput:
      type: object
      required: [marketPrice, spotPrice, strikePrice, timeToExpirationYears, riskFreeRate, optionType]
      properties:
        marketPrice: { type: number, example: 2.15 }
        spotPrice: { type: number, example: 228.50 }
        strikePrice: { type: number, example: 220.00 }
        timeToExpirationYears: { type: number, example: 0.0822 }
        riskFreeRate: { type: number, example: 0.045 }
        optionType: { type: string, enum: [CALL, PUT], example: PUT }

    ImpliedVolatilityOutput:
      type: object
      properties:
        impliedVolatility: { type: number, example: 0.2485 }
        iterations: { type: integer, example: 3 }
        converged: { type: boolean, example: true }

    BrokerOrderInput:
      type: object
      required: [symbol, qty, side, type, timeInForce]
      properties:
        symbol: { type: string, example: AAPL }
        qty: { type: integer, example: 10 }
        side: { type: string, enum: [buy, sell], example: buy }
        type: { type: string, enum: [market, limit], example: market }
        timeInForce: { type: string, enum: [day, gtc], example: day }
        limitPrice: { type: number, example: 228.00 }

    BrokerOrderOutput:
      type: object
      properties:
        orderId: { type: string, example: '904837cc-ae9b-4b1a-8c02-5aed3245b3d7' }
        clientOrderId: { type: string, example: 'ORD-982173' }
        symbol: { type: string, example: AAPL }
        qty: { type: integer, example: 10 }
        side: { type: string, example: buy }
        status: { type: string, example: accepted }
        createdAt: { type: string, format: date-time }

    PayoffMatrixOutput:
      type: object
      properties:
        strategyId: { type: string, example: 'PORT-TECH-COLLAR-01' }
        symbol: { type: string, example: NVDA }
        spotPriceAtEntry: { type: number, example: 125.80 }
        sharesCount: { type: integer, example: 100 }
        breakeven: { type: number, example: 125.77 }
        floorPrice: { type: number, example: 119.50 }
        payoffMatrix:
          type: array
          items:
            type: object
            properties:
              spotAtExpiry: { type: number, example: 110.00 }
              stockPnL: { type: number, example: -1580.00 }
              optionsPnL: { type: number, example: 953.00 }
              netStrategyPnL: { type: number, example: -627.00 }
`;

const compIdx = content.indexOf('components:');
if (compIdx !== -1) {
  content = content.substring(0, compIdx) + componentsSection;
  fs.writeFileSync(specPath, content, 'utf8');
  console.log('spec/openspec.yaml actualizado con componentes enriquecidos.');

  // Sincronizar también con U2Act2/spec/openspec.yaml si existe
  const u2SpecPath = path.join(__dirname, '../../U2Act2/spec/openspec.yaml');
  if (fs.existsSync(u2SpecPath)) {
    fs.writeFileSync(u2SpecPath, content, 'utf8');
    console.log('U2Act2/spec/openspec.yaml sincronizado exitosamente.');
  }

  const parsed = yaml.load(specPath);
  console.log('Validación yamljs OK! Total esquemas:', Object.keys(parsed.components.schemas).length);
  console.log('Esquemas:', Object.keys(parsed.components.schemas));
} else {
  console.error('Error: No se encontró la sección components: en openspec.yaml');
}

