import mongoose from 'mongoose';
import config from '../src/config/config.js';
import HedgingStrategy from '../src/api/v1/models/HedgingStrategy.model.js';

async function migrate() {
  console.log('Conectando a MongoDB Atlas...');
  await mongoose.connect(config.MONGODB_URI, { dbName: config.MONGODB_DB_NAME });

  const result = await HedgingStrategy.updateMany(
    { $or: [{ broker: { $exists: false } }, { broker: null }] },
    { $set: { broker: 'ALPACA' } }
  );

  console.log(`Migración completada exitosamente: ${result.modifiedCount} estrategias actualizadas con broker = 'ALPACA'.`);
  await mongoose.disconnect();
}

migrate().catch(console.error);

