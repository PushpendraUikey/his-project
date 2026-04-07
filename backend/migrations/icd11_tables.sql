-- ============================================================
-- ICD-11 Codes Table Migration
-- Run AFTER schema.sql
-- ============================================================

-- Enable pg_trgm for fast trigram-based ILIKE search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── ICD-11 codes lookup table ─────────────────────────────────
CREATE TABLE IF NOT EXISTS icd11_codes (
  code        TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  parent_code TEXT,
  category    TEXT
);

-- GIN trigram index for fast ILIKE search on description
CREATE INDEX IF NOT EXISTS idx_icd11_desc_trgm
  ON icd11_codes USING gin (description gin_trgm_ops);

-- Exact code prefix lookup
CREATE INDEX IF NOT EXISTS idx_icd11_code
  ON icd11_codes (code);

-- ── Add ICD-11 coded diagnosis columns to admissions ─────────
-- Keeps existing diagnosis_primary (plain text) intact
ALTER TABLE admissions
  ADD COLUMN IF NOT EXISTS diagnosis_code        TEXT,
  ADD COLUMN IF NOT EXISTS diagnosis_description TEXT;
