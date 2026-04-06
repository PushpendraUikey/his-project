# MediCore HIS — Hospital Information System
### ADT · LIS · HIE with FHIR R4 / HL7 v3

A full-stack Hospital Information System featuring ADT (Admissions/Discharges/Transfers), LIS (Laboratory Information System), and HIE (Health Information Exchange) with FHIR R4 messaging.

---

## Stack

| Layer      | Technology                              |
|------------|----------------------------------------|
| Frontend   | React 18 + Tailwind CSS (Vite)         |
| Backend    | Node.js + Express + JWT Auth           |
| Database   | PostgreSQL 14+                         |
| Standards  | FHIR R4, HL7 v2 ADT/ORU, LOINC, SNOMED CT |

---

## Features

### 🏥 ADT Module (Admission, Discharge, Transfer)
- Patient search and fetch from HIS (no re-registration needed)
- Admit patient → ward and bed assignment → FHIR ADT A01 sent to HIE
- Internal transfer (change ward/bed) → FHIR ADT A02
- External transfer (refer to another hospital) → FHIR ADT A02 with destination
- Discharge → FHIR ADT A03 sent to HIE

### 🧪 LIS Module (Laboratory Information System)
- Doctor writes lab orders (CBC, LFT, BMP, Troponin, etc.)
- Lab technician marks specimen collected
- Results entry with reference ranges and abnormal flags
- When all tests result → FHIR ORU R01 auto-sent to HIE

### 🔄 HIE Module (Health Information Exchange)
- Real-time FHIR R4 message log (ADT A01/A02/A03, ORU R01)
- Interactive JSON viewer for each FHIR Bundle
- Resources: MessageHeader, Patient, Encounter, Practitioner, Location, DiagnosticReport, ServiceRequest, Observation
- Inbound FHIR Bundle endpoint (POST /api/hie/receive)
- FHIR resource endpoints for Patient, Encounter, DiagnosticReport

### 🔐 Role-based Authentication

| Role           | Modules Accessible                | Demo Code |
|----------------|-----------------------------------|-----------|
| Doctor         | Doctor's View, Lab, HIE           | DOC-001   |
| Nurse          | Nurse's Station, Admission, HIE   | NRS-001   |
| Lab Technician | Laboratory, HIE                   | LAB-001   |
| Admin          | All modules                       | ADM-001   |

Default demo password: `password123`

---

## Setup

### 1. Database

```bash
createdb his_db
psql his_db < schema.sql
psql his_db < additional_schema.sql
psql his_db < seed_full.sql
psql his_db < backend/migrations/hie_tables.sql
```

### 2. Backend

```bash
cd backend
cp .env.example .env
# Set DB_HOST, DB_NAME, DB_USER, DB_PASSWORD, JWT_SECRET
npm install
npm run dev
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## FHIR R4 Messages Generated

| HL7 Event | Trigger                              | Resources in Bundle                                              |
|-----------|--------------------------------------|------------------------------------------------------------------|
| ADT A01   | Admission Desk → Admit               | MessageHeader, Patient, Encounter, Practitioner, Location        |
| ADT A02   | Transfer (internal or external)      | MessageHeader, Patient, Encounter, Practitioner, Location        |
| ADT A03   | Admission Desk → Discharge           | MessageHeader, Patient, Encounter (status: finished)             |
| ORU R01   | Lab → all tests resulted             | MessageHeader, Patient, ServiceRequest, DiagnosticReport, Observation[] |

---

## Key API Endpoints

### HIE / FHIR
- GET  /api/hie/messages — list FHIR message log
- GET  /api/hie/stats — ADT/ORU counts
- POST /api/hie/adt — generate ADT bundle
- POST /api/hie/lab-result — generate ORU R01 bundle
- GET  /api/hie/fhir/Patient/:id
- GET  /api/hie/fhir/Encounter/:id
- GET  /api/hie/fhir/DiagnosticReport/:id
- POST /api/hie/receive — receive inbound FHIR Bundle

### ADT
- POST /api/admission/admit
- POST /api/admission/discharge
- POST /api/admission/transfer (internal)
- POST /api/admission/external-transfer
