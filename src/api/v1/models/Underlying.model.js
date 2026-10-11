import mongoose from 'mongoose';

const underlyingSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    symbol: { type: String, required: true, uppercase: true, trim: true },
    companyName: { type: String, required: true, trim: true },
    spotPrice: { type: Number, required: true, min: 0.01 },
    volatility: { type: Number, required: true, min: 0, default: 0.2 },
    sector: { type: String, default: 'FINANCIAL' },
    active: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'underlyings',
  }
);

underlyingSchema.index({ symbol: 1 });

underlyingSchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

export default mongoose.model('Underlying', underlyingSchema, 'underlyings');

