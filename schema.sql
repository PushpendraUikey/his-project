-- ============================================================
-- HIS (Hospital Information System) Complete Schema
-- PostgreSQL Database Schema
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

BEGIN;

-- ============================================================
-- 1. WARDS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS wards (
  ward_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ward_code     VARCHAR(50) NOT NULL UNIQUE,
  ward_name     VARCHAR(100) NOT NULL,
  ward_type     VARCHAR(50) NOT NULL CHECK (ward_type IN ('general', 'icu', 'surgical', 'maternity', 'pediatric', 'emergency', 'pediatric')),
  department    VARCHAR(100),
  total_beds    INTEGER,
  floor_number  INTEGER,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_wards_code ON wards(ward_code);
CREATE INDEX idx_wards_active ON wards(is_active);

-- ============================================================
-- 2. BEDS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS beds (
  bed_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ward_id           UUID NOT NULL REFERENCES wards(ward_id) ON DELETE RESTRICT,
  bed_number        VARCHAR(50) NOT NULL,
  bed_type          VARCHAR(50) NOT NULL CHECK (bed_type IN ('standard', 'icu', 'maternity', 'pediatric')),
  status            VARCHAR(50) NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'cleaning', 'maintenance', 'reserved')),
  status_updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ward_id, bed_number)
);

CREATE INDEX idx_beds_ward ON beds(ward_id);
CREATE INDEX idx_beds_status ON beds(status);

-- ============================================================
-- 3. PROVIDERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS providers (
  provider_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_code VARCHAR(50) NOT NULL UNIQUE,
  full_name     VARCHAR(150) NOT NULL,
  specialty     VARCHAR(100),
  license_number VARCHAR(100),
  role          VARCHAR(50) NOT NULL CHECK (role IN ('doctor', 'nurse', 'lab_technician', 'admin')),
  is_active     BOOLEAN DEFAULT TRUE,
  password_hash VARCHAR(255),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_providers_code ON providers(provider_code);
CREATE INDEX idx_providers_role ON providers(role);
CREATE INDEX idx_providers_active ON providers(is_active);

-- ============================================================
-- 4. PATIENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS patients (
  patient_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mrn           VARCHAR(50) NOT NULL UNIQUE,
  first_name    VARCHAR(100) NOT NULL,
  last_name     VARCHAR(100) NOT NULL,
  dob           DATE,
  gender        VARCHAR(20) CHECK (gender IN ('male', 'female', 'other')),
  blood_group   VARCHAR(10),
  national_id   VARCHAR(100),
  phone         VARCHAR(20),
  email         VARCHAR(100),
  address       JSONB,  -- { line1, city, state, pincode }
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_patients_mrn ON patients(mrn);
CREATE INDEX idx_patients_name ON patients(last_name, first_name);
CREATE INDEX idx_patients_phone ON patients(phone);

-- ============================================================
-- 5. PATIENT INSURANCE TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS patient_insurance (
  insurance_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id    UUID NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
  provider_name VARCHAR(150) NOT NULL,
  policy_number VARCHAR(100) NOT NULL,
  group_number  VARCHAR(100),
  valid_from    DATE,
  valid_to      DATE,
  is_primary    BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_insurance_patient ON patient_insurance(patient_id);
CREATE INDEX idx_insurance_policy ON patient_insurance(policy_number);

-- ============================================================
-- 6. ADMISSIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS admissions (
  admission_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_number       VARCHAR(50) NOT NULL UNIQUE,
  patient_id             UUID NOT NULL REFERENCES patients(patient_id) ON DELETE RESTRICT,
  bed_id                 UUID REFERENCES beds(bed_id) ON DELETE SET NULL,
  admitting_provider_id  UUID NOT NULL REFERENCES providers(provider_id) ON DELETE RESTRICT,
  attending_provider_id  UUID REFERENCES providers(provider_id) ON DELETE SET NULL,
  admitted_at            TIMESTAMPTZ DEFAULT NOW(),
  admission_type         VARCHAR(50) NOT NULL CHECK (admission_type IN ('emergency', 'elective', 'maternity')),
  admission_source       VARCHAR(100) CHECK (admission_source IN ('emergency', 'opd', 'referral', 'direct', 'transfer')),
  chief_complaint        TEXT,
  diagnosis_primary      TEXT,
  status                 VARCHAR(50) NOT NULL DEFAULT 'admitted' CHECK (status IN ('admitted', 'discharged', 'transferred', 'expired')),
  transfer_destination   VARCHAR(200),
  transfer_type          VARCHAR(20) CHECK (transfer_type IN ('internal', 'external')),
  updated_at             TIMESTAMPTZ DEFAULT NOW(),
  created_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_admissions_patient ON admissions(patient_id);
CREATE INDEX idx_admissions_bed ON admissions(bed_id);
CREATE INDEX idx_admissions_status ON admissions(status);
CREATE INDEX idx_admissions_admitted ON admissions(admitted_at DESC);

-- ============================================================
-- 7. DISCHARGES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS discharges (
  discharge_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id         UUID NOT NULL REFERENCES admissions(admission_id) ON DELETE CASCADE,
  discharging_provider_id UUID REFERENCES providers(provider_id) ON DELETE SET NULL,
  discharge_disposition VARCHAR(100),
  discharge_condition   VARCHAR(50),
  discharge_summary    TEXT,
  follow_up_required   BOOLEAN DEFAULT FALSE,
  follow_up_date       DATE,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_discharges_admission ON discharges(admission_id);

-- ============================================================
-- 8. VITAL SIGNS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS vital_signs (
  vital_sign_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id       UUID NOT NULL REFERENCES admissions(admission_id) ON DELETE CASCADE,
  recorded_by        UUID REFERENCES providers(provider_id) ON DELETE SET NULL,
  recorded_at        TIMESTAMPTZ DEFAULT NOW(),
  systolic_bp        DECIMAL(3,0),
  diastolic_bp       DECIMAL(3,0),
  heart_rate         DECIMAL(3,0),
  temperature        DECIMAL(4,1),
  spo2               DECIMAL(5,2),
  respiratory_rate   DECIMAL(3,0),
  weight_kg          DECIMAL(6,2),
  height_cm          DECIMAL(5,1),
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vitals_admission ON vital_signs(admission_id);
CREATE INDEX idx_vitals_recorded ON vital_signs(recorded_at DESC);

-- ============================================================
-- 9. NURSING NOTES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS nursing_notes (
  note_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id  UUID NOT NULL REFERENCES admissions(admission_id) ON DELETE CASCADE,
  author_id     UUID NOT NULL REFERENCES providers(provider_id) ON DELETE RESTRICT,
  noted_at      TIMESTAMPTZ DEFAULT NOW(),
  note_type     VARCHAR(50) NOT NULL CHECK (note_type IN ('admission', 'progress', 'discharge', 'nursing')),
  note_content  TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_nursing_admission ON nursing_notes(admission_id);
CREATE INDEX idx_nursing_noted ON nursing_notes(noted_at DESC);

-- ============================================================
-- 10. LAB TEST DEFINITIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS lab_test_definitions (
  test_definition_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_code          VARCHAR(50) NOT NULL UNIQUE,
  test_name          VARCHAR(150) NOT NULL,
  category           VARCHAR(100),
  specimen_required  VARCHAR(100),
  loinc_code         VARCHAR(20),
  turnaround_hours   INTEGER,
  requires_fasting   BOOLEAN DEFAULT FALSE,
  is_active          BOOLEAN DEFAULT TRUE,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_lab_test_code ON lab_test_definitions(test_code);
CREATE INDEX idx_lab_test_active ON lab_test_definitions(is_active);

-- ============================================================
-- 11. LAB ORDERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS lab_orders (
  lab_order_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number          VARCHAR(50) NOT NULL UNIQUE,
  admission_id          UUID NOT NULL REFERENCES admissions(admission_id) ON DELETE CASCADE,
  patient_id            UUID NOT NULL REFERENCES patients(patient_id) ON DELETE RESTRICT,
  ordering_provider_id  UUID NOT NULL REFERENCES providers(provider_id) ON DELETE RESTRICT,
  ordered_at            TIMESTAMPTZ DEFAULT NOW(),
  priority              VARCHAR(50) NOT NULL DEFAULT 'routine' CHECK (priority IN ('critical', 'stat', 'routine')),
  order_status          VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (order_status IN ('pending', 'collected', 'processing', 'resulted', 'cancelled')),
  clinical_notes        TEXT,
  specimen_type         VARCHAR(100),
  collected_at          TIMESTAMPTZ,
  collected_by          VARCHAR(150),
  results_received_at   TIMESTAMPTZ,
  lis_accession_number  VARCHAR(100),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_lab_order_admission ON lab_orders(admission_id);
CREATE INDEX idx_lab_order_patient ON lab_orders(patient_id);
CREATE INDEX idx_lab_order_status ON lab_orders(order_status);
CREATE INDEX idx_lab_order_ordered ON lab_orders(ordered_at DESC);

-- ============================================================
-- 12. LAB ORDER TESTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS lab_order_tests (
  order_test_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_order_id         UUID NOT NULL REFERENCES lab_orders(lab_order_id) ON DELETE CASCADE,
  test_definition_id   UUID NOT NULL REFERENCES lab_test_definitions(test_definition_id) ON DELETE RESTRICT,
  individual_status    VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (individual_status IN ('pending', 'collected', 'processing', 'resulted', 'cancelled')),
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_lab_order_tests_order ON lab_order_tests(lab_order_id);
CREATE INDEX idx_lab_order_tests_def ON lab_order_tests(test_definition_id);
CREATE INDEX idx_lab_order_tests_status ON lab_order_tests(individual_status);

-- ============================================================
-- 13. LAB RESULTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS lab_results (
  result_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_test_id          UUID NOT NULL REFERENCES lab_order_tests(order_test_id) ON DELETE CASCADE,
  validated_by           UUID REFERENCES providers(provider_id) ON DELETE SET NULL,
  resulted_at            TIMESTAMPTZ DEFAULT NOW(),
  validated_at           TIMESTAMPTZ,
  numeric_value          DECIMAL(20, 6),
  text_value             TEXT,
  unit                   VARCHAR(50),
  reference_range_low    VARCHAR(50),
  reference_range_high   VARCHAR(50),
  abnormal_flag          VARCHAR(5) CHECK (abnormal_flag IN ('L', 'H', 'LL', 'HH', 'N')),
  result_status          VARCHAR(50) NOT NULL DEFAULT 'final' CHECK (result_status IN ('preliminary', 'final', 'amended', 'cancelled')),
  is_critical            BOOLEAN DEFAULT FALSE,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_lab_result_test ON lab_results(order_test_id);
CREATE INDEX idx_lab_result_critical ON lab_results(is_critical);

-- ============================================================
-- 14. DOCTOR ORDERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS doctor_orders (
  order_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id   UUID NOT NULL REFERENCES admissions(admission_id) ON DELETE CASCADE,
  doctor_id      UUID NOT NULL REFERENCES providers(provider_id) ON DELETE RESTRICT,
  order_type     VARCHAR(50) NOT NULL CHECK (order_type IN ('lab', 'medication', 'admit', 'discharge', 'transfer')),
  status         VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  lab_order_id   UUID REFERENCES lab_orders(lab_order_id) ON DELETE SET NULL,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_doctor_orders_admission ON doctor_orders(admission_id);
CREATE INDEX idx_doctor_orders_doctor ON doctor_orders(doctor_id);
CREATE INDEX idx_doctor_orders_status ON doctor_orders(status);

-- ============================================================
-- 15. ADT AUDIT LOG TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS adt_audit_log (
  audit_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id      UUID NOT NULL REFERENCES admissions(admission_id) ON DELETE CASCADE,
  performed_by      UUID REFERENCES providers(provider_id) ON DELETE SET NULL,
  event_type        VARCHAR(50) NOT NULL CHECK (event_type IN ('ADMIT', 'TRANSFER', 'DISCHARGE', 'CANCEL')),
  event_description TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_adt_admission ON adt_audit_log(admission_id);
CREATE INDEX idx_adt_event ON adt_audit_log(event_type);
CREATE INDEX idx_adt_created ON adt_audit_log(created_at DESC);

-- ============================================================
-- 16. PATIENT TRANSFERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS patient_transfers (
  transfer_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id        UUID NOT NULL REFERENCES admissions(admission_id) ON DELETE CASCADE,
  transfer_type       VARCHAR(20) NOT NULL CHECK (transfer_type IN ('internal', 'external')),
  from_bed_id         UUID REFERENCES beds(bed_id) ON DELETE SET NULL,
  to_bed_id           UUID REFERENCES beds(bed_id) ON DELETE SET NULL,
  to_facility_name    VARCHAR(200),
  to_facility_address TEXT,
  reason              TEXT,
  ordered_by          UUID REFERENCES providers(provider_id) ON DELETE SET NULL,
  transfer_status     VARCHAR(20) DEFAULT 'pending' CHECK (transfer_status IN ('pending', 'completed', 'cancelled')),
  transferred_at      TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transfers_admission ON patient_transfers(admission_id);
CREATE INDEX idx_transfers_type ON patient_transfers(transfer_type);

-- ============================================================
-- 17. HIE MESSAGE LOG TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS hie_message_log (
  log_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id     VARCHAR(100) UNIQUE,
  message_type   VARCHAR(20) NOT NULL CHECK (message_type IN ('ADT_A01', 'ADT_A02', 'ADT_A03', 'ORU_R01')),
  event_type     VARCHAR(30) NOT NULL CHECK (event_type IN ('ADMIT', 'TRANSFER', 'DISCHARGE', 'LAB_RESULT')),
  patient_id     UUID REFERENCES patients(patient_id) ON DELETE SET NULL,
  admission_id   UUID REFERENCES admissions(admission_id) ON DELETE SET NULL,
  lab_order_id   UUID REFERENCES lab_orders(lab_order_id) ON DELETE SET NULL,
  fhir_bundle    JSONB NOT NULL,
  direction      VARCHAR(10) NOT NULL DEFAULT 'outbound' CHECK (direction IN ('outbound', 'inbound')),
  status         VARCHAR(20) NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'received', 'error', 'acknowledged')),
  destination    VARCHAR(200) DEFAULT 'internal',
  source_system  VARCHAR(100) DEFAULT 'MediCore HIS',
  triggered_by   UUID REFERENCES providers(provider_id) ON DELETE SET NULL,
  error_detail   TEXT,
  sent_at        TIMESTAMPTZ DEFAULT NOW(),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_hie_log_patient ON hie_message_log(patient_id);
CREATE INDEX idx_hie_log_admission ON hie_message_log(admission_id);
CREATE INDEX idx_hie_log_type ON hie_message_log(message_type);
CREATE INDEX idx_hie_log_sent_at ON hie_message_log(sent_at DESC);

COMMIT;

-- ============================================================
-- Schema creation complete
-- ============================================================
