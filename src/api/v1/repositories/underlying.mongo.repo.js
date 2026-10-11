import Underlying from '../models/Underlying.model.js';
import { randomUUID } from 'crypto';

export class UnderlyingMongoRepository {
  async getAll(filter = {}) {
    const query = { deletedAt: null, ...filter };
    return await Underlying.find(query).sort({ symbol: 1 });
  }

  async getById(id) {
    return await Underlying.findOne({ _id: id, deletedAt: null });
  }

  async getBySymbol(symbol) {
    return await Underlying.findOne({ symbol: symbol.toUpperCase(), deletedAt: null });
  }

  async create(data) {
    const id = data.id || data._id || `UND-${data.symbol.toUpperCase()}-${randomUUID().slice(0, 4)}`;
    const newDoc = new Underlying({ ...data, _id: id });
    return await newDoc.save();
  }

  async createBatch(items) {
    const docs = items.map((item) => ({
      ...item,
      _id: item.id || item._id || `UND-${item.symbol.toUpperCase()}-${randomUUID().slice(0, 4)}`,
    }));
    return await Underlying.insertMany(docs);
  }

  async update(id, data) {
    return await Underlying.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: data },
      { new: true, runValidators: true }
    );
  }

  async delete(id) {
    return await Underlying.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: { deletedAt: new Date(), active: false } },
      { new: true }
    );
  }
}

