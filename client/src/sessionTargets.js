export const DEFAULT_DATABASE = 'mongodb';
export const DEFAULT_BROKER = 'WEBULL';

export const databaseOptions = [
  { value: 'mongodb', label: 'MongoDB', detail: '(NoSQL)' },
  { value: 'supabase', label: 'Supabase', detail: '(SQL)' },
];

export const brokerOptions = [
  { value: 'IBKR', label: 'IBKR', detail: '(TWS)' },
  { value: 'ALPACA', label: 'Alpaca', detail: 'Markets' },
  { value: 'WEBULL', label: 'Webull' },
];
