import dotenv from 'dotenv';
dotenv.config();

const config = {
  HOST: process.env.HOST || 'localhost',
  PORT: Number(process.env.PORT || 3050),
  API_URL: process.env.API_URL || '/api/v1',
  NODE_ENV: process.env.NODE_ENV || 'development',
  JWT_SECRET: process.env.JWT_SECRET || 'los_eddies_default_jwt_secret',
  
  // MongoDB
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/',
  MONGODB_DB_NAME: process.env.MONGODB_DB_NAME || 'fintech_hedging_db',
  
  // Supabase
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
  
  // Broker Configuration & Selection
  DEFAULT_BROKER: (process.env.DEFAULT_BROKER || 'WEBULL').toUpperCase(),

  // Broker Alpaca
  ALPACA_API_KEY_ID: process.env.ALPACA_API_KEY_ID || '',
  ALPACA_API_SECRET_KEY: process.env.ALPACA_API_SECRET_KEY || '',
  ALPACA_BASE_URL: process.env.ALPACA_BASE_URL || 'https://paper-api.alpaca.markets',
  ALPACA_DATA_URL: process.env.ALPACA_DATA_URL || 'https://data.alpaca.markets/v2',

  // Broker Webull OpenAPI
  WEBULL_APP_KEY: process.env.WEBULL_APP_KEY || '',
  WEBULL_APP_SECRET: process.env.WEBULL_APP_SECRET || '',
  WEBULL_ACCOUNT_ID: process.env.WEBULL_ACCOUNT_ID || '',
  WEBULL_BASE_URL: process.env.WEBULL_BASE_URL || 'https://api.webull.com/openapi',
};

export default config;

