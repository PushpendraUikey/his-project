-- ============================================================
-- HIE (Health Information Exchange) Tables Migration
-- Run this after schema.sql + seed_full.sql
-- ============================================================

-- HIE Message Log: stores every FHIR R4 Bundle sent/received
CREATE TABLE IF NOT EXISTS hie_message_log (
  log_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id       VARCHAR(100) UNIQUE,            -- FHIR Bundle.id
  message_type     VARCHAR(20)  NOT NULL,           -- ADT_A01, ADT_A02, ADT_A03, ORU_R01
  event_type       VARCHAR(30)  NOT NULL,           -- ADMIT, TRANSFER, DISCHARGE, LAB_RESULT
  patient_id       UUID REFERENCES patients(patient_id) ON DELETE SET NULL,
  admission_id     UUID REFERENCES admissions(admission_id) ON DELETE SET NULL,
  lab_order_id     UUID REFERENCES lab_orders(lab_order_id) ON DELETE SET NULL,
  fhir_bundle      JSONB        NOT NULL,           -- full FHIR R4 Bundle JSON
  direction        VARCHAR(10)  NOT NULL DEFAULT 'outbound', -- outbound | inbound
  status           VARCHAR(20)  NOT NULL DEFAULT 'sent',     -- sent | received | error | acknowledged
  destination      VARCHAR(200) DEFAULT 'internal',          -- 'internal' or external facility name
  source_system    VARCHAR(100) DEFAULT 'MediCore HIS',
  triggered_by     UUID REFERENCES providers(provider_id) ON DELETE SET NULL,
  error_detail     TEXT,
  sent_at          TIMESTAMPTZ  DEFAULT NOW(),
  created_at       TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hie_log_patient    ON hie_message_log(patient_id);
CREATE INDEX IF NOT EXISTS idx_hie_log_admission  ON hie_message_log(admission_id);
CREATE INDEX IF NOT EXISTS idx_hie_log_type       ON hie_message_log(message_type);
CREATE INDEX IF NOT EXISTS idx_hie_log_sent_at    ON hie_message_log(sent_at DESC);

-- Transfer Log: tracks patient movement (internal & external)
CREATE TABLE IF NOT EXISTS patient_transfers (
  transfer_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id        UUID NOT NULL REFERENCES admissions(admission_id),
  transfer_type       VARCHAR(20) NOT NULL, -- internal | external
  from_bed_id         UUID REFERENCES beds(bed_id),
  to_bed_id           UUID REFERENCES beds(bed_id),
  to_facility_name    VARCHAR(200),          -- for external transfers
  to_facility_address TEXT,
  reason              TEXT,
  ordered_by          UUID REFERENCES providers(provider_id),
  transfer_status     VARCHAR(20) DEFAULT 'pending', -- pending | completed | cancelled
  transferred_at      TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transfers_admission ON patient_transfers(admission_id);

-- Update admissions to support transfer status
ALTER TABLE admissions ADD COLUMN IF NOT EXISTS transfer_destination VARCHAR(200);
ALTER TABLE admissions ADD COLUMN IF NOT EXISTS transfer_type VARCHAR(20);
