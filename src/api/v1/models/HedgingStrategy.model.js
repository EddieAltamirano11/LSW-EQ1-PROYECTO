import mongoose from 'mongoose';

const legSchema = new mongoose.Schema(
  {
    legId: { type: String, required: true },
    legRole: {
      type: String,
      required: true,
      enum: ['UNDERLYING', 'HEDGE_FLOOR', 'FINANCE_CEILING', 'STOCK', 'LONG_PUT', 'SHORT_CALL'],
    },
    assetType: { type: String, required: true, enum: ['EQUITY', 'OPTION'] },
    contractSymbol: { type: String, default: null },
    optionType: { type: String, enum: ['CALL', 'PUT', null], default: null },
    strike: { type: Number, default: null },
    expirationDate: { type: Date, default: null },
    quantity: { type: Number, required: true, min: 1 },
    entryPrice: { type: Number, required: true, min: 0 },
    delta: { type: Number, default: 0.0 },
    gamma: { type: Number, default: 0.0 },
    theta: { type: Number, default: 0.0 },
    vega: { type: Number, default: 0.0 },
  },
  { _id: false }
);

const underlyingSubSchema = new mongoose.Schema(
  {
    symbol: { type: String, required: true, uppercase: true, trim: true },
    companyName: { type: String, required: true, trim: true },
    spotPriceAtEntry: { type: Number, required: true, min: 0.01 },
    sharesCount: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const financialMetricsSubSchema = new mongoose.Schema(
  {
    netDebitCredit: { type: Number, required: true },
    breakevenPrice: { type: Number, required: true },
    floorProtectionPrice: { type: Number, required: true },
    maxLossTotalUSD: { type: Number, required: true },
    netDelta: { type: Number, default: 0.0 },
  },
  { _id: false }
);

const hedgingStrategySchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    portfolioId: { type: String, required: true },
    broker: {
      type: String,
      required: true,
      enum: ['ALPACA', 'IBKR', 'WEBULL', 'SIMULATED'],
      default: 'ALPACA',
      uppercase: true,
    },
    strategyType: {
      type: String,
      required: true,
      enum: ['PROTECTIVE_PUT', 'COLLAR', 'COLLAR_SPREAD'],
    },
    status: {
      type: String,
      required: true,
      enum: ['ACTIVE', 'CLOSED', 'EXPIRED'],
      default: 'ACTIVE',
    },
    underlying: { type: underlyingSubSchema, required: true },
    legs: { type: [legSchema], required: true },
    financialMetrics: { type: financialMetricsSubSchema, required: true },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'hedging_strategies',
  }
);

hedgingStrategySchema.index({ portfolioId: 1, status: 1 });
hedgingStrategySchema.index({ 'underlying.symbol': 1 });

hedgingStrategySchema.set('toJSON', {
  transform: (_doc, ret) => {
    const id = ret._id;
    delete ret._id;
    return { id, ...ret };
  },
});

export default mongoose.model('HedgingStrategy', hedgingStrategySchema, 'hedging_strategies');

