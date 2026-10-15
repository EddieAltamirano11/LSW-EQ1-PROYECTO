-- ==========================================================
-- MIGRACIÓN DDL PARA SUPABASE POSTGRESQL (EQUIPO 1)
-- ==========================================================
-- Agrega la columna física 'broker' a la tabla de coberturas

ALTER TABLE tbl_hedging_strategies 
ADD COLUMN IF NOT EXISTS broker TEXT DEFAULT 'WEBULL';

-- Actualizar registros históricos con el broker guardado en financial_metrics o por defecto 'ALPACA'
UPDATE tbl_hedging_strategies 
SET broker = COALESCE(financial_metrics->>'broker', 'ALPACA') 
WHERE broker IS NULL;

-- Índice para acelerar búsquedas y filtros por broker bursátil
CREATE INDEX IF NOT EXISTS idx_hedging_strategies_broker 
ON tbl_hedging_strategies(broker);

-- Opcional: Agregar columna broker a tbl_underlyings si se desea auditar la procedencia del activo
ALTER TABLE tbl_underlyings 
ADD COLUMN IF NOT EXISTS broker TEXT DEFAULT 'WEBULL';

