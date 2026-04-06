# MediCore HIS — Hospital Information System

A full-stack Hospital Information System with 5 role-based UI modules.

## Stack
- **Frontend** React 18 + Tailwind CSS (Vite)
- **Backend** Node.js + Express
- **Database** PostgreSQL 14+ (`his_db`)

---

## Project Structure

```
his-project/
├── backend/
│   ├── index.js              # Express entry point
│   ├── db.js                 # pg Pool connection
│   ├── .env.example          # Copy to .env and fill in DB credentials
│   └── routes/
│       ├── registration.js   # Patient CRUD
│       ├── admission.js      # Admit / discharge / bed management
│       ├── nurse.js          # Vitals + nursing notes
│       ├── doctor.js         # Orders + full patient context
│       └── lab.js            # Specimen collection + result entry
│
├── frontend/
│   ├── vite.config.js        # Dev proxy → :4000
│   └── src/
│       ├── main.jsx          # Router entry
│       ├── index.css         # Tailwind + design tokens
│       ├── lib/api.js        # All fetch calls centralised
│       ├── components/
│       │   ├── Layout.jsx    # Sidebar + nav
│       │   └── ui.jsx        # Shared components
│       └── pages/
│           ├── Registration.jsx
│           ├── Admission.jsx
│           ├── Nurse.jsx
│           ├── Doctor.jsx
│           └── Lab.jsx
│
└── database/
    └── seed_full.sql         # Full dummy dataset
```

---

## Setup

### 1. Database

```bash
# Create DB
psql -U postgres -c "CREATE DATABASE his_db;"

# Run schemas (in order)
psql -U postgres -d his_db -f schema.sql
psql -U postgres -d his_db -f additional_schema.sql

# Seed dummy data
psql -U postgres -d his_db -f database/seed_full.sql
```

### 2. Backend

```bash
cd backend
cp .env.example .env
# Edit .env — set DB_PASSWORD and other values

npm install
npm run dev       # Runs on :4000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev       # Runs on :3000, proxies /api → :4000
```

Open [http://localhost:3000](http://localhost:3000)

---

## Modules

| Module | Route | Role | Key Features |
|---|---|---|---|
| Registration | `/registration` | Front desk | Search patients, register, edit details + insurance |
| Admission | `/admission` | Admission desk | Admit patient, assign bed, view bed grid, discharge |
| Nurse's Station | `/nurse` | Nurse | Two-panel: patient list + vitals/notes entry |
| Doctor's View | `/doctor` | Doctor | Full patient context — vitals, orders, labs, notes |
| Laboratory | `/lab` | Lab Technician | Manage orders by status, collect specimen, enter results |

---

## Dummy Data Loaded

| Entity | Count |
|---|---|
| Wards | 7 (General, ICU, Surgical, Maternity, Paediatric, Emergency) |
| Beds | 20 across all wards |
| Providers | 13 (6 doctors, 4 nurses, 2 lab techs, 1 admin) |
| Patients | 10 with realistic clinical scenarios |
| Admissions | 8 active (ACS, AF, ICU trauma, Typhoid, Maternity, Paediatric, Pre-op surgery, Stroke) |
| Lab Orders | 6 in various states (pending → resulted) |
| Lab Results | 5 (Troponin critical, CBC low, LFT elevated, WBC high) |
| Doctor Orders | 6 |
| Nursing Notes | 8 |
| Vital Signs | 13 entries across patients |

---

## API Endpoints

### Registration
```
GET  /api/registration/patients?q=       Search patients
GET  /api/registration/patients/:id      Get patient + insurance
POST /api/registration/patients          Register new patient
PUT  /api/registration/patients/:id      Update patient
```

### Admission
```
GET  /api/admission/beds                 Available beds
GET  /api/admission/beds/all             All beds with status
GET  /api/admission/providers            Active doctors
GET  /api/admission/admissions           Active admissions
POST /api/admission/admit                Admit patient
POST /api/admission/discharge            Discharge patient
```

### Nurse
```
GET  /api/nurse/admissions               All active admissions
GET  /api/nurse/vitals/:admissionId      Vitals history
POST /api/nurse/vitals                   Record vitals
GET  /api/nurse/notes/:admissionId       Nursing notes
POST /api/nurse/notes                    Add note
GET  /api/nurse/nurses                   List nurses
```

### Doctor
```
GET  /api/doctor/patients?doctor_id=     Patient list
GET  /api/doctor/patient/:admissionId    Full patient context
POST /api/doctor/orders                  Create order (lab/admit/discharge/transfer)
GET  /api/doctor/lab-tests               Lab test catalog
GET  /api/doctor/doctors                 List doctors
```

### Lab
```
GET   /api/lab/orders?status=            Lab orders by status
PATCH /api/lab/orders/:id/collect        Mark specimen collected
POST  /api/lab/results                   Enter test result
GET   /api/lab/technicians               List technicians
```
