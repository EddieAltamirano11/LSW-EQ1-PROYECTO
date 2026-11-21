-- ==========================================================
-- MIGRACIÓN SUPABASE: estado PARTIALLY_EXECUTED (Equipo 1)
-- ==========================================================
-- Change: ejecucion-de-coberturas-multipata (2026-11-20).
-- Sin la clave de servicio no se pudo confirmar si tbl_hedging_strategies.status tiene una restricción de valores.
-- Este script es idempotente y sirve en los tres casos posibles:
--   1. status es TEXT sin restricción: no cambia nada.
--   2. status tiene un CHECK con la lista de valores: lo reemplaza por uno que incluye PARTIALLY_EXECUTED.
--   3. status es un tipo ENUM: agrega el valor PARTIALLY_EXECUTED.
-- Ejecutarlo en el SQL Editor de Supabase antes de desplegar el backend.

DO $$
DECLARE
  restriccion RECORD;
  tipo_columna TEXT;
BEGIN
  SELECT t.typname, t.typtype INTO tipo_columna
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_type t ON t.oid = a.atttypid
  WHERE c.relname = 'tbl_hedging_strategies' AND a.attname = 'status';

  -- Caso 3: tipo ENUM
  IF EXISTS (
    SELECT 1 FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_type t ON t.oid = a.atttypid
    WHERE c.relname = 'tbl_hedging_strategies' AND a.attname = 'status' AND t.typtype = 'e'
  ) THEN
    EXECUTE format('ALTER TYPE %I ADD VALUE IF NOT EXISTS %L', tipo_columna, 'PARTIALLY_EXECUTED');
  END IF;

  -- Caso 2: restricciones CHECK que mencionan status
  FOR restriccion IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    WHERE c.relname = 'tbl_hedging_strategies' AND con.contype = 'c' AND pg_get_constraintdef(con.oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE tbl_hedging_strategies DROP CONSTRAINT %I', restriccion.conname);
    EXECUTE 'ALTER TABLE tbl_hedging_strategies ADD CONSTRAINT tbl_hedging_strategies_status_check '
         || 'CHECK (status IN (''ACTIVE'', ''PARTIALLY_EXECUTED'', ''CLOSED'', ''EXPIRED''))';
  END LOOP;
END $$;
