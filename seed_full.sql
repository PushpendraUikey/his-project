-- ============================================================
-- HIS FULL SEED DATA
-- Run after schema.sql + additional_schema.sql
-- ============================================================

BEGIN;

-- ── 1. WARDS ──────────────────────────────────────────────
INSERT INTO wards (ward_id, ward_code, ward_name, ward_type, department, total_beds, floor_number) VALUES
  ('a1000001-0000-0000-0000-000000000001', 'GEN-A',  'General Ward A',       'general',   'Internal Medicine', 30, 1),
  ('a1000001-0000-0000-0000-000000000002', 'GEN-B',  'General Ward B',       'general',   'Internal Medicine', 28, 1),
  ('a1000001-0000-0000-0000-000000000003', 'ICU-1',  'Medical ICU',          'icu',       'Critical Care',     12, 2),
  ('a1000001-0000-0000-0000-000000000004', 'SURG-A', 'Surgical Ward A',      'surgical',  'Surgery',           24, 3),
  ('a1000001-0000-0000-0000-000000000005', 'MAT-1',  'Maternity Ward',       'maternity', 'Obstetrics',        20, 2),
  ('a1000001-0000-0000-0000-000000000006', 'PED-1',  'Paediatric Ward',      'pediatric', 'Paediatrics',       18, 2),
  ('a1000001-0000-0000-0000-000000000007', 'EMRG',   'Emergency Department', 'emergency', 'Emergency',         16, 0);

-- ── 2. BEDS ───────────────────────────────────────────────
INSERT INTO beds (bed_id, ward_id, bed_number, bed_type, status) VALUES
  -- General Ward A
  ('b0000001-0000-0000-0000-000000000001','a1000001-0000-0000-0000-000000000001','GA-01','standard','occupied'),
  ('b0000001-0000-0000-0000-000000000002','a1000001-0000-0000-0000-000000000001','GA-02','standard','occupied'),
  ('b0000001-0000-0000-0000-000000000003','a1000001-0000-0000-0000-000000000001','GA-03','standard','available'),
  ('b0000001-0000-0000-0000-000000000004','a1000001-0000-0000-0000-000000000001','GA-04','standard','available'),
  ('b0000001-0000-0000-0000-000000000005','a1000001-0000-0000-0000-000000000001','GA-05','standard','dirty'),
  -- General Ward B
  ('b0000001-0000-0000-0000-000000000006','a1000001-0000-0000-0000-000000000002','GB-01','standard','occupied'),
  ('b0000001-0000-0000-0000-000000000007','a1000001-0000-0000-0000-000000000002','GB-02','standard','available'),
  ('b0000001-0000-0000-0000-000000000008','a1000001-0000-0000-0000-000000000002','GB-03','standard','available'),
  -- ICU
  ('b0000001-0000-0000-0000-000000000009','a1000001-0000-0000-0000-000000000003','ICU-01','icu','occupied'),
  ('b0000001-0000-0000-0000-000000000010','a1000001-0000-0000-0000-000000000003','ICU-02','icu','available'),
  ('b0000001-0000-0000-0000-000000000011','a1000001-0000-0000-0000-000000000003','ICU-03','icu','available'),
  -- Surgical
  ('b0000001-0000-0000-0000-000000000012','a1000001-0000-0000-0000-000000000004','SG-01','standard','occupied'),
  ('b0000001-0000-0000-0000-000000000013','a1000001-0000-0000-0000-000000000004','SG-02','standard','available'),
  -- Maternity
  ('b0000001-0000-0000-0000-000000000014','a1000001-0000-0000-0000-000000000005','MT-01','maternity','occupied'),
  ('b0000001-0000-0000-0000-000000000015','a1000001-0000-0000-0000-000000000005','MT-02','maternity','available'),
  -- Paediatric
  ('b0000001-0000-0000-0000-000000000016','a1000001-0000-0000-0000-000000000006','PD-01','pediatric','occupied'),
  ('b0000001-0000-0000-0000-000000000017','a1000001-0000-0000-0000-000000000006','PD-02','pediatric','available'),
  -- Emergency
  ('b0000001-0000-0000-0000-000000000018','a1000001-0000-0000-0000-000000000007','EM-01','standard','occupied'),
  ('b0000001-0000-0000-0000-000000000019','a1000001-0000-0000-0000-000000000007','EM-02','standard','available'),
  ('b0000001-0000-0000-0000-000000000020','a1000001-0000-0000-0000-000000000007','EM-03','standard','available');

-- ── 3. PROVIDERS ──────────────────────────────────────────
ALTER TABLE providers ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
ALTER TABLE providers ADD COLUMN IF NOT EXISTS password_must_change BOOLEAN DEFAULT FALSE;

INSERT INTO providers (provider_id, provider_code, full_name, specialty, license_number, role, password_hash, password_must_change) VALUES
  -- Doctors
  ('c0000001-0000-0000-0000-000000000001','DOC-001','Dr. Arjun Mehta',        'Internal Medicine',  'MH-MED-10234', 'doctor', '$2a$12$79v3TCMNE19qClh.8SiNGOVlNU/jDGHO477wyNPMukcZbaMskaX7C', FALSE),
  ('c0000001-0000-0000-0000-000000000002','DOC-002','Dr. Priya Krishnaswamy', 'Cardiology',         'MH-CAR-20871', 'doctor', '$2a$12$79v3TCMNE19qClh.8SiNGOVlNU/jDGHO477wyNPMukcZbaMskaX7C', FALSE),
  ('c0000001-0000-0000-0000-000000000003','DOC-003','Dr. Rohan Desai',        'Surgery',            'MH-SRG-30145', 'doctor', '$2a$12$79v3TCMNE19qClh.8SiNGOVlNU/jDGHO477wyNPMukcZbaMskaX7C', FALSE),
  ('c0000001-0000-0000-0000-000000000004','DOC-004','Dr. Sneha Patel',        'Obstetrics',         'MH-OBS-40562', 'doctor', '$2a$12$79v3TCMNE19qClh.8SiNGOVlNU/jDGHO477wyNPMukcZbaMskaX7C', FALSE),
  ('c0000001-0000-0000-0000-000000000005','DOC-005','Dr. Vikram Nair',        'Paediatrics',        'MH-PED-50789', 'doctor', '$2a$12$79v3TCMNE19qClh.8SiNGOVlNU/jDGHO477wyNPMukcZbaMskaX7C', FALSE),
  ('c0000001-0000-0000-0000-000000000006','DOC-006','Dr. Ananya Sharma',      'Critical Care',      'MH-CCM-60312', 'doctor', '$2a$12$79v3TCMNE19qClh.8SiNGOVlNU/jDGHO477wyNPMukcZbaMskaX7C', FALSE),
  -- Nurses
  ('c0000001-0000-0000-0000-000000000011','NRS-001','Nurse Kavitha Ramesh',   NULL, 'MH-NRS-11001', 'nurse', '$2a$12$79v3TCMNE19qClh.8SiNGOVlNU/jDGHO477wyNPMukcZbaMskaX7C', FALSE),
  ('c0000001-0000-0000-0000-000000000012','NRS-002','Nurse Deepa Pillai',     NULL, 'MH-NRS-11002', 'nurse', '$2a$12$79v3TCMNE19qClh.8SiNGOVlNU/jDGHO477wyNPMukcZbaMskaX7C', FALSE),
  ('c0000001-0000-0000-0000-000000000013','NRS-003','Nurse Suresh Babu',      NULL, 'MH-NRS-11003', 'nurse', '$2a$12$79v3TCMNE19qClh.8SiNGOVlNU/jDGHO477wyNPMukcZbaMskaX7C', FALSE),
  ('c0000001-0000-0000-0000-000000000014','NRS-004','Nurse Amita Singh',      NULL, 'MH-NRS-11004', 'nurse', '$2a$12$79v3TCMNE19qClh.8SiNGOVlNU/jDGHO477wyNPMukcZbaMskaX7C', FALSE),
  -- Lab Technicians
  ('c0000001-0000-0000-0000-000000000021','LAB-001','Ravi Shankar Kumar',     NULL, 'MH-LAB-21001', 'lab_technician', '$2a$12$79v3TCMNE19qClh.8SiNGOVlNU/jDGHO477wyNPMukcZbaMskaX7C', FALSE),
  ('c0000001-0000-0000-0000-000000000022','LAB-002','Meena Tiwari',           NULL, 'MH-LAB-21002', 'lab_technician', '$2a$12$79v3TCMNE19qClh.8SiNGOVlNU/jDGHO477wyNPMukcZbaMskaX7C', FALSE),
  -- Admin
  ('c0000001-0000-0000-0000-000000000031','ADM-001','Prakash Iyer',           NULL, 'MH-ADM-31001', 'admin', '$2a$12$79v3TCMNE19qClh.8SiNGOVlNU/jDGHO477wyNPMukcZbaMskaX7C', FALSE),
  -- Registration Desk
  ('c0000001-0000-0000-0000-000000000041','REG-001','Sunita Devi',            NULL, 'MH-REG-41001', 'registration_desk', '$2a$12$79v3TCMNE19qClh.8SiNGOVlNU/jDGHO477wyNPMukcZbaMskaX7C', FALSE),
  -- Admission Desk
  ('c0000001-0000-0000-0000-000000000042','ADT-001','Rajesh Sharma',          NULL, 'MH-ADT-42001', 'admission_desk', '$2a$12$79v3TCMNE19qClh.8SiNGOVlNU/jDGHO477wyNPMukcZbaMskaX7C', FALSE);

-- ── 4. PATIENTS ───────────────────────────────────────────
INSERT INTO patients (patient_id, mrn, first_name, last_name, dob, gender, blood_group, national_id, phone, email, address) VALUES
  ('d0000001-0000-0000-0000-000000000001','MRN-20240101-0001','Ramesh',    'Gupta',       '1958-04-12','male',  'B+',  '614678986666','9812345678','ramesh.gupta@email.com',  '{"line1":"12 Gandhi Nagar","city":"Mumbai","state":"Maharashtra","pincode":"400001"}'),
  ('d0000001-0000-0000-0000-000000000002','MRN-20240101-0002','Sunita',    'Sharma',      '1975-09-23','female','A+',  '614678988535','9823456789','sunita.sharma@email.com', '{"line1":"45 Nehru Road","city":"Pune","state":"Maharashtra","pincode":"411001"}'),
  ('d0000001-0000-0000-0000-000000000003','MRN-20240101-0003','Arjun',     'Patil',       '1990-02-15','male',  'O+',  '614678924526','9834567890','arjun.patil@email.com',   '{"line1":"7 MG Road","city":"Nagpur","state":"Maharashtra","pincode":"440001"}'),
  ('d0000001-0000-0000-0000-000000000004','MRN-20240101-0004','Priya',     'Reddy',       '1988-11-30','female','AB+', '614678946264','9845678901','priya.reddy@email.com',   '{"line1":"23 Station Road","city":"Nashik","state":"Maharashtra","pincode":"422001"}'),
  ('d0000001-0000-0000-0000-000000000005','MRN-20240101-0005','Mohan',     'Kulkarni',    '1945-07-08','male',  'A-',  '614678914624','9856789012',NULL,                      '{"line1":"5 Temple Street","city":"Aurangabad","state":"Maharashtra","pincode":"431001"}'),
  ('d0000001-0000-0000-0000-000000000006','MRN-20240101-0006','Anjali',    'Deshmukh',    '1995-03-17','female','O-',  '614678914542','9867890123','anjali.d@email.com',       '{"line1":"89 Shivaji Chowk","city":"Solapur","state":"Maharashtra","pincode":"413001"}'),
  ('d0000001-0000-0000-0000-000000000007','MRN-20240101-0007','Suresh',    'Joshi',       '1965-12-25','male',  'B-',  '614678914435','9878901234',NULL,                      '{"line1":"3 Laxmi Lane","city":"Kolhapur","state":"Maharashtra","pincode":"416001"}'),
  ('d0000001-0000-0000-0000-000000000008','MRN-20240101-0008','Kavitha',   'Nair',        '1982-06-04','female','B+',  '614678982455','9889012345','kavitha.nair@email.com',  '{"line1":"17 Beach Road","city":"Mumbai","state":"Maharashtra","pincode":"400005"}'),
  ('d0000001-0000-0000-0000-000000000009','MRN-20240101-0009','Deepak',    'Verma',       '2001-01-19','male',  'A+',  '614678982354','9890123456','deepak.verma@email.com',  '{"line1":"66 Civil Lines","city":"Nagpur","state":"Maharashtra","pincode":"440001"}'),
  ('d0000001-0000-0000-0000-000000000010','MRN-20240101-0010','Lalita',    'Rane',        '1938-08-30','female','O+',  '614678986555','9801234567',NULL,                      '{"line1":"2 Old Town Road","city":"Pune","state":"Maharashtra","pincode":"411002"}');

-- ── 5. PATIENT INSURANCE ──────────────────────────────────
INSERT INTO patient_insurance (patient_id, provider_name, policy_number, group_number, valid_from, valid_to, is_primary) VALUES
  ('d0000001-0000-0000-0000-000000000001', 'Star Health Insurance',  'SH-2024-001234', 'GRP-A', '2024-01-01','2024-12-31', TRUE),
  ('d0000001-0000-0000-0000-000000000002', 'HDFC ERGO Health',       'HE-2024-005678', 'GRP-B', '2024-04-01','2025-03-31', TRUE),
  ('d0000001-0000-0000-0000-000000000003', 'Bajaj Allianz Health',   'BA-2024-009012', NULL,    '2023-10-01','2024-09-30', TRUE),
  ('d0000001-0000-0000-0000-000000000006', 'New India Assurance',    'NI-2024-003456', 'GRP-C', '2024-01-01','2024-12-31', TRUE),
  ('d0000001-0000-0000-0000-000000000008', 'United India Insurance', 'UI-2024-007890', NULL,    '2024-06-01','2025-05-31', TRUE);

-- ── 6. ADMISSIONS ─────────────────────────────────────────
INSERT INTO admissions
  (admission_id, admission_number, patient_id, bed_id, admitting_provider_id, attending_provider_id,
   admitted_at, admission_type, admission_source, chief_complaint, diagnosis_primary, status)
VALUES
  ('e0000001-0000-0000-0000-000000000001','ADM-20240320-00001',
   'd0000001-0000-0000-0000-000000000001','b0000001-0000-0000-0000-000000000001',
   'c0000001-0000-0000-0000-000000000001','c0000001-0000-0000-0000-000000000001',
   NOW() - INTERVAL '3 days','emergency','emergency',
   'Chest pain radiating to left arm','Acute Coronary Syndrome','admitted'),

  ('e0000001-0000-0000-0000-000000000002','ADM-20240320-00002',
   'd0000001-0000-0000-0000-000000000002','b0000001-0000-0000-0000-000000000002',
   'c0000001-0000-0000-0000-000000000001','c0000001-0000-0000-0000-000000000002',
   NOW() - INTERVAL '2 days','elective','opd',
   'Palpitations and breathlessness','Atrial Fibrillation','admitted'),

  ('e0000001-0000-0000-0000-000000000003','ADM-20240320-00003',
   'd0000001-0000-0000-0000-000000000003','b0000001-0000-0000-0000-000000000009',
   'c0000001-0000-0000-0000-000000000006','c0000001-0000-0000-0000-000000000006',
   NOW() - INTERVAL '1 day','emergency','emergency',
   'Motor vehicle accident, polytrauma','Traumatic Brain Injury + Rib fractures','admitted'),

  ('e0000001-0000-0000-0000-000000000004','ADM-20240320-00004',
   'd0000001-0000-0000-0000-000000000004','b0000001-0000-0000-0000-000000000006',
   'c0000001-0000-0000-0000-000000000001','c0000001-0000-0000-0000-000000000001',
   NOW() - INTERVAL '5 days','elective','referral',
   'Fever with chills for 7 days','Typhoid Fever','admitted'),

  ('e0000001-0000-0000-0000-000000000005','ADM-20240320-00005',
   'd0000001-0000-0000-0000-000000000006','b0000001-0000-0000-0000-000000000014',
   'c0000001-0000-0000-0000-000000000004','c0000001-0000-0000-0000-000000000004',
   NOW() - INTERVAL '1 day','maternity','direct',
   'Full term pregnancy, active labour','G2P1, 39 weeks gestation, active labour','admitted'),

  ('e0000001-0000-0000-0000-000000000006','ADM-20240320-00006',
   'd0000001-0000-0000-0000-000000000009','b0000001-0000-0000-0000-000000000016',
   'c0000001-0000-0000-0000-000000000005','c0000001-0000-0000-0000-000000000005',
   NOW() - INTERVAL '2 days','emergency','emergency',
   'High fever with febrile seizure','Febrile Seizure secondary to pneumonia','admitted'),

  ('e0000001-0000-0000-0000-000000000007','ADM-20240320-00007',
   'd0000001-0000-0000-0000-000000000007','b0000001-0000-0000-0000-000000000012',
   'c0000001-0000-0000-0000-000000000003','c0000001-0000-0000-0000-000000000003',
   NOW() - INTERVAL '4 hours','elective','opd',
   'Acute appendicitis, pre-op','Acute Appendicitis','admitted'),

  ('e0000001-0000-0000-0000-000000000008','ADM-20240320-00008',
   'd0000001-0000-0000-0000-000000000010','b0000001-0000-0000-0000-000000000018',
   'c0000001-0000-0000-0000-000000000001','c0000001-0000-0000-0000-000000000001',
   NOW() - INTERVAL '6 hours','emergency','emergency',
   'Sudden onset weakness right side, slurred speech','Acute Ischaemic Stroke','admitted');

-- ── 7. VITAL SIGNS ────────────────────────────────────────
INSERT INTO vital_signs (admission_id, recorded_by, recorded_at, systolic_bp, diastolic_bp, heart_rate, temperature, spo2, respiratory_rate, weight_kg, height_cm) VALUES
  -- Patient 1 (ACS)
  ('e0000001-0000-0000-0000-000000000001','c0000001-0000-0000-0000-000000000011', NOW()-INTERVAL '3 days',  160, 100, 98,  37.2, 96, 18, 72, 168),
  ('e0000001-0000-0000-0000-000000000001','c0000001-0000-0000-0000-000000000011', NOW()-INTERVAL '2 days',  145, 92,  88,  37.0, 97, 17, 72, 168),
  ('e0000001-0000-0000-0000-000000000001','c0000001-0000-0000-0000-000000000011', NOW()-INTERVAL '6 hours', 132, 84,  82,  36.9, 98, 16, 72, 168),
  -- Patient 2 (AF)
  ('e0000001-0000-0000-0000-000000000002','c0000001-0000-0000-0000-000000000012', NOW()-INTERVAL '2 days',  130, 85,  115, 37.1, 95, 20, 65, 162),
  ('e0000001-0000-0000-0000-000000000002','c0000001-0000-0000-0000-000000000012', NOW()-INTERVAL '12 hours',125, 80,  102, 37.0, 96, 19, 65, 162),
  -- Patient 3 (ICU - TBI)
  ('e0000001-0000-0000-0000-000000000003','c0000001-0000-0000-0000-000000000013', NOW()-INTERVAL '1 day',   90,  60,  120, 38.5, 92, 28, 80, 175),
  ('e0000001-0000-0000-0000-000000000003','c0000001-0000-0000-0000-000000000013', NOW()-INTERVAL '6 hours', 95,  65,  110, 38.2, 93, 24, 80, 175),
  -- Patient 4 (Typhoid)
  ('e0000001-0000-0000-0000-000000000004','c0000001-0000-0000-0000-000000000011', NOW()-INTERVAL '5 days',  100, 65,  102, 39.6, 97, 20, 58, 160),
  ('e0000001-0000-0000-0000-000000000004','c0000001-0000-0000-0000-000000000011', NOW()-INTERVAL '2 days',  108, 70,  95,  38.8, 98, 18, 58, 160),
  ('e0000001-0000-0000-0000-000000000004','c0000001-0000-0000-0000-000000000011', NOW()-INTERVAL '2 hours', 114, 72,  88,  38.1, 99, 17, 58, 160),
  -- Patient 6 (Paed)
  ('e0000001-0000-0000-0000-000000000006','c0000001-0000-0000-0000-000000000014', NOW()-INTERVAL '2 days',  90,  60,  130, 40.2, 94, 30, 22, 118),
  ('e0000001-0000-0000-0000-000000000006','c0000001-0000-0000-0000-000000000014', NOW()-INTERVAL '8 hours', 95,  62,  118, 39.1, 96, 26, 22, 118),
  -- Patient 8 (Stroke)
  ('e0000001-0000-0000-0000-000000000008','c0000001-0000-0000-0000-000000000012', NOW()-INTERVAL '6 hours', 185, 110, 90,  37.3, 97, 18, 68, 158);

-- ── 8. NURSING NOTES ──────────────────────────────────────
INSERT INTO nursing_notes (admission_id, author_id, noted_at, note_type, note_content) VALUES
  ('e0000001-0000-0000-0000-000000000001','c0000001-0000-0000-0000-000000000011', NOW()-INTERVAL '3 days',  'admission',  'Patient admitted via emergency. Complaining of severe chest pain 8/10. ECG done and sent to cardiologist. IV access established, O2 at 2L/min.'),
  ('e0000001-0000-0000-0000-000000000001','c0000001-0000-0000-0000-000000000011', NOW()-INTERVAL '2 days',  'progress',   'Patient comfortable on current medications. Pain reduced to 3/10. Tolerating oral feeds. No fresh complaints.'),
  ('e0000001-0000-0000-0000-000000000002','c0000001-0000-0000-0000-000000000012', NOW()-INTERVAL '2 days',  'admission',  'Patient admitted for palpitations. HR irregular on monitoring. Cardiologist Dr. Krishnaswamy reviewed. Holter monitoring initiated.'),
  ('e0000001-0000-0000-0000-000000000003','c0000001-0000-0000-0000-000000000013', NOW()-INTERVAL '1 day',   'admission',  'Critical patient transferred from ER post RTA. GCS 8/15. Intubated and on ventilator. CT head and chest done. Neurosurgery and trauma surgery on standby.'),
  ('e0000001-0000-0000-0000-000000000003','c0000001-0000-0000-0000-000000000013', NOW()-INTERVAL '4 hours', 'progress',   'GCS remains 9/15 — slight improvement. Pupils equal and reactive. Urine output adequate. Family counselled regarding critical status.'),
  ('e0000001-0000-0000-0000-000000000004','c0000001-0000-0000-0000-000000000011', NOW()-INTERVAL '5 days',  'admission',  'Patient referred from district hospital with 7-day history of step-ladder fever and relative bradycardia. Widal test positive. IV antibiotics started.'),
  ('e0000001-0000-0000-0000-000000000006','c0000001-0000-0000-0000-000000000014', NOW()-INTERVAL '2 days',  'admission',  'Child aged 23y brought by parents with high grade fever and one episode of generalised tonic-clonic seizure lasting 2 min. Post-ictal now. IV access done. Paed resident reviewed.'),
  ('e0000001-0000-0000-0000-000000000008','c0000001-0000-0000-0000-000000000012', NOW()-INTERVAL '6 hours', 'admission',  'Elderly lady brought by son with sudden right-sided weakness and slurring of speech. BP very high at 185/110. Neurology team called. CT head obtained — no bleed. tPA considered.');

-- ── 9. LAB TEST DEFINITIONS (already in seed.sql, insert only if not exists) ─
INSERT INTO lab_test_definitions (test_code, test_name, category, specimen_required, loinc_code, turnaround_hours, requires_fasting)
  VALUES
    ('CBC',      'Complete Blood Count',          'hematology',    'Whole Blood (EDTA)',  '58410-2', 2,   FALSE),
    ('BMP',      'Basic Metabolic Panel',         'biochemistry',  'Serum',               '51990-0', 4,   TRUE),
    ('LFT',      'Liver Function Test',           'biochemistry',  'Serum',               '24325-3', 4,   TRUE),
    ('RFT',      'Renal Function Test',           'biochemistry',  'Serum',               '24362-6', 4,   FALSE),
    ('LPS',      'Lipid Profile',                 'biochemistry',  'Serum',               '57698-3', 4,   TRUE),
    ('HBA1C',    'HbA1c Glycated Hemoglobin',     'endocrinology', 'Whole Blood (EDTA)',  '4548-4',  6,   FALSE),
    ('TSH',      'Thyroid Stimulating Hormone',   'endocrinology', 'Serum',               '11579-0', 8,   FALSE),
    ('URINE_RE', 'Urine Routine Examination',     'urine_analysis','Mid-stream Urine',    '24357-6', 2,   FALSE),
    ('PT_INR',   'Prothrombin Time INR',          'coagulation',   'Citrated Plasma',     '6301-6',  2,   FALSE),
    ('CULTURE',  'Blood Culture Sensitivity',     'microbiology',  'Whole Blood',         '17934-1', 72,  FALSE),
    ('COVID_RT', 'COVID-19 RT-PCR',               'serology',      'Nasopharyngeal Swab', '94500-6', 6,   FALSE),
    ('TROP_I',   'Troponin I Cardiac Marker',     'biochemistry',  'Serum',               '42757-5', 1,   FALSE)
  ON CONFLICT (test_code) DO NOTHING;

-- ── 10. LAB ORDERS ────────────────────────────────────────
INSERT INTO lab_orders
  (lab_order_id, order_number, admission_id, patient_id, ordering_provider_id, ordered_at, priority, order_status, clinical_notes)
VALUES
  ('f0000001-0000-0000-0000-000000000001','LAB-20240320-00001',
   'e0000001-0000-0000-0000-000000000001','d0000001-0000-0000-0000-000000000001',
   'c0000001-0000-0000-0000-000000000001', NOW()-INTERVAL '3 days','critical','resulted',
   'Urgent cardiac workup. Rule out MI.'),

  ('f0000001-0000-0000-0000-000000000002','LAB-20240320-00002',
   'e0000001-0000-0000-0000-000000000001','d0000001-0000-0000-0000-000000000001',
   'c0000001-0000-0000-0000-000000000002', NOW()-INTERVAL '2 days','routine','pending',
   'Follow-up: BMP and coagulation screen.'),

  ('f0000001-0000-0000-0000-000000000003','LAB-20240320-00003',
   'e0000001-0000-0000-0000-000000000003','d0000001-0000-0000-0000-000000000003',
   'c0000001-0000-0000-0000-000000000006', NOW()-INTERVAL '1 day','stat','collected',
   'Trauma workup. Urgent.'),

  ('f0000001-0000-0000-0000-000000000004','LAB-20240320-00004',
   'e0000001-0000-0000-0000-000000000004','d0000001-0000-0000-0000-000000000004',
   'c0000001-0000-0000-0000-000000000001', NOW()-INTERVAL '4 days','routine','resulted',
   'Typhoid workup — LFT and CBC to monitor.'),

  ('f0000001-0000-0000-0000-000000000005','LAB-20240320-00005',
   'e0000001-0000-0000-0000-000000000006','d0000001-0000-0000-0000-000000000009',
   'c0000001-0000-0000-0000-000000000005', NOW()-INTERVAL '2 days','stat','processing',
   'Paediatric sepsis screen.'),

  ('f0000001-0000-0000-0000-000000000006','LAB-20240320-00006',
   'e0000001-0000-0000-0000-000000000008','d0000001-0000-0000-0000-000000000010',
   'c0000001-0000-0000-0000-000000000001', NOW()-INTERVAL '5 hours','stat','pending',
   'Stroke workup — coag screen, CBC, BMP.');

-- Update collected status for order 3
UPDATE lab_orders SET collected_at = NOW()-INTERVAL '20 hours', collected_by='Ravi Shankar Kumar',
  specimen_type='Whole Blood (EDTA)' WHERE lab_order_id='f0000001-0000-0000-0000-000000000003';

-- ── 11. LAB ORDER TESTS ───────────────────────────────────
INSERT INTO lab_order_tests (order_test_id, lab_order_id, test_definition_id, individual_status) VALUES
  -- Order 1: Troponin I + CBC (resulted)
  ('a1000001-0000-0000-0000-000000000101','f0000001-0000-0000-0000-000000000001',
   (SELECT test_definition_id FROM lab_test_definitions WHERE test_code='TROP_I'), 'resulted'),
  ('a1000001-0000-0000-0000-000000000102','f0000001-0000-0000-0000-000000000001',
   (SELECT test_definition_id FROM lab_test_definitions WHERE test_code='CBC'), 'resulted'),

  -- Order 2: BMP + PT_INR (pending)
  ('a1000001-0000-0000-0000-000000000103','f0000001-0000-0000-0000-000000000002',
   (SELECT test_definition_id FROM lab_test_definitions WHERE test_code='BMP'), 'pending'),
  ('a1000001-0000-0000-0000-000000000104','f0000001-0000-0000-0000-000000000002',
   (SELECT test_definition_id FROM lab_test_definitions WHERE test_code='PT_INR'), 'pending'),

  -- Order 3: CBC + BMP + PT_INR
  ('a1000001-0000-0000-0000-000000000105','f0000001-0000-0000-0000-000000000003',
   (SELECT test_definition_id FROM lab_test_definitions WHERE test_code='CBC'), 'pending'),
  ('a1000001-0000-0000-0000-000000000106','f0000001-0000-0000-0000-000000000003',
   (SELECT test_definition_id FROM lab_test_definitions WHERE test_code='BMP'), 'pending'),
  ('a1000001-0000-0000-0000-000000000107','f0000001-0000-0000-0000-000000000003',
   (SELECT test_definition_id FROM lab_test_definitions WHERE test_code='PT_INR'), 'pending'),

  -- Order 4: CBC + LFT (resulted)
  ('a1000001-0000-0000-0000-000000000108','f0000001-0000-0000-0000-000000000004',
   (SELECT test_definition_id FROM lab_test_definitions WHERE test_code='CBC'), 'resulted'),
  ('a1000001-0000-0000-0000-000000000109','f0000001-0000-0000-0000-000000000004',
   (SELECT test_definition_id FROM lab_test_definitions WHERE test_code='LFT'), 'resulted'),

  -- Order 5: CBC + CULTURE
  ('a1000001-0000-0000-0000-000000000110','f0000001-0000-0000-0000-000000000005',
   (SELECT test_definition_id FROM lab_test_definitions WHERE test_code='CBC'), 'resulted'),
  ('a1000001-0000-0000-0000-000000000111','f0000001-0000-0000-0000-000000000005',
   (SELECT test_definition_id FROM lab_test_definitions WHERE test_code='CULTURE'), 'pending'),

  -- Order 6: CBC + BMP + PT_INR
  ('a1000001-0000-0000-0000-000000000112','f0000001-0000-0000-0000-000000000006',
   (SELECT test_definition_id FROM lab_test_definitions WHERE test_code='CBC'), 'pending'),
  ('a1000001-0000-0000-0000-000000000113','f0000001-0000-0000-0000-000000000006',
   (SELECT test_definition_id FROM lab_test_definitions WHERE test_code='BMP'), 'pending'),
  ('a1000001-0000-0000-0000-000000000114','f0000001-0000-0000-0000-000000000006',
   (SELECT test_definition_id FROM lab_test_definitions WHERE test_code='PT_INR'), 'pending');

-- ── 12. LAB RESULTS ───────────────────────────────────────
INSERT INTO lab_results
  (order_test_id, validated_by, resulted_at, validated_at, numeric_value, unit,
   reference_range_low, reference_range_high, abnormal_flag, result_status, is_critical)
VALUES
  -- Troponin I — elevated (critical)
  ('a1000001-0000-0000-0000-000000000101','c0000001-0000-0000-0000-000000000021',
   NOW()-INTERVAL '2 days 20 hours', NOW()-INTERVAL '2 days 19 hours',
   2.85, 'ng/mL', '0', '0.04', 'HH', 'final', TRUE),

  -- CBC for patient 1
  ('a1000001-0000-0000-0000-000000000102','c0000001-0000-0000-0000-000000000021',
   NOW()-INTERVAL '2 days 18 hours', NOW()-INTERVAL '2 days 17 hours',
   11.2, 'g/dL', '13.5', '17.5', 'L', 'final', FALSE),

  -- CBC for typhoid patient
  ('a1000001-0000-0000-0000-000000000108','c0000001-0000-0000-0000-000000000022',
   NOW()-INTERVAL '3 days 20 hours', NOW()-INTERVAL '3 days 19 hours',
   3.8, '×10³/μL', '4.5', '11', 'L', 'final', FALSE),

  -- LFT for typhoid patient
  ('a1000001-0000-0000-0000-000000000109','c0000001-0000-0000-0000-000000000022',
   NOW()-INTERVAL '3 days 18 hours', NOW()-INTERVAL '3 days 17 hours',
   88, 'U/L', '7', '56', 'H', 'final', FALSE),

  -- CBC for paed patient
  ('a1000001-0000-0000-0000-000000000110','c0000001-0000-0000-0000-000000000021',
   NOW()-INTERVAL '1 day 20 hours', NOW()-INTERVAL '1 day 19 hours',
   18.5, '×10³/μL', '5', '14', 'HH', 'final', FALSE);

-- ── 13. DOCTOR ORDERS ─────────────────────────────────────
INSERT INTO doctor_orders (order_id, admission_id, doctor_id, order_type, status, lab_order_id, notes, created_at) VALUES
  ('a2000001-0000-0000-0000-000000000201',
   'e0000001-0000-0000-0000-000000000001','c0000001-0000-0000-0000-000000000001',
   'lab','completed','f0000001-0000-0000-0000-000000000001',
   'Urgent cardiac enzymes — TROP_I and CBC. Repeat if negative at 3hrs.',
   NOW()-INTERVAL '3 days'),

  ('a2000001-0000-0000-0000-000000000202',
   'e0000001-0000-0000-0000-000000000001','c0000001-0000-0000-0000-000000000002',
   'lab','pending','f0000001-0000-0000-0000-000000000002',
   'Follow up BMP and coagulation after starting LMWH.',
   NOW()-INTERVAL '2 days'),

  ('a2000001-0000-0000-0000-000000000203',
   'e0000001-0000-0000-0000-000000000003','c0000001-0000-0000-0000-000000000006',
   'lab','in_progress','f0000001-0000-0000-0000-000000000003',
   'Urgent trauma workup. Patient ventilated in ICU.',
   NOW()-INTERVAL '1 day'),

  ('a2000001-0000-0000-0000-000000000204',
   'e0000001-0000-0000-0000-000000000004','c0000001-0000-0000-0000-000000000001',
   'lab','completed','f0000001-0000-0000-0000-000000000004',
   'Baseline CBC and LFT for typhoid monitoring.',
   NOW()-INTERVAL '4 days'),

  ('a2000001-0000-0000-0000-000000000205',
   'e0000001-0000-0000-0000-000000000008','c0000001-0000-0000-0000-000000000001',
   'lab','pending','f0000001-0000-0000-0000-000000000006',
   'Stroke workup. Urgent coag before considering thrombolysis.',
   NOW()-INTERVAL '5 hours'),

  ('a2000001-0000-0000-0000-000000000206',
   'e0000001-0000-0000-0000-000000000007','c0000001-0000-0000-0000-000000000003',
   'admit','completed',NULL,
   'Patient admitted pre-op. NPO after midnight. Consent obtained.',
   NOW()-INTERVAL '4 hours');

-- ── 14. ADT AUDIT LOG ─────────────────────────────────────
INSERT INTO adt_audit_log (admission_id, performed_by, event_type, event_description) VALUES
  ('e0000001-0000-0000-0000-000000000001','c0000001-0000-0000-0000-000000000001','ADMIT','Patient admitted via emergency — ACS protocol activated'),
  ('e0000001-0000-0000-0000-000000000002','c0000001-0000-0000-0000-000000000001','ADMIT','Patient admitted electively for AF management'),
  ('e0000001-0000-0000-0000-000000000003','c0000001-0000-0000-0000-000000000006','ADMIT','Critical trauma patient — ICU bed allocated'),
  ('e0000001-0000-0000-0000-000000000004','c0000001-0000-0000-0000-000000000001','ADMIT','Referral admission — Typhoid fever management'),
  ('e0000001-0000-0000-0000-000000000005','c0000001-0000-0000-0000-000000000004','ADMIT','Maternity admission — active labour'),
  ('e0000001-0000-0000-0000-000000000006','c0000001-0000-0000-0000-000000000005','ADMIT','Paediatric emergency — febrile seizure'),
  ('e0000001-0000-0000-0000-000000000007','c0000001-0000-0000-0000-000000000003','ADMIT','Pre-operative admission — acute appendicitis'),
  ('e0000001-0000-0000-0000-000000000008','c0000001-0000-0000-0000-000000000001','ADMIT','Emergency stroke admission — neurology alerted');

COMMIT;
