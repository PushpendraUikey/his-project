/**
 * HIE (Health Information Exchange) Routes
 * Implements FHIR R4 resource generation and HL7 message logging
 *
 * Message Types:
 *   ADT_A01 → Patient Admission
 *   ADT_A02 → Patient Transfer
 *   ADT_A03 → Patient Discharge
 *   ORU_R01 → Lab Results
 *
 * FHIR R4 Resources used:
 *   Bundle, MessageHeader, Patient, Encounter, Practitioner,
 *   Location, ServiceRequest, DiagnosticReport, Observation
 */

import { Router } from 'express';
import pool from '../db.js';
import { authenticateToken } from './auth.js';
import crypto from 'crypto';

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// FHIR R4 Resource Builders
// ─────────────────────────────────────────────────────────────────────────────

function buildFHIRPatient(patient) {
  const addr = typeof patient.address === 'string'
    ? JSON.parse(patient.address)
    : (patient.address || {});

  return {
    resourceType: 'Patient',
    id: patient.patient_id,
    meta: {
      profile: ['http://hl7.org/fhir/StructureDefinition/Patient'],
      lastUpdated: new Date().toISOString(),
    },
    identifier: [
      {
        use: 'usual',
        type: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
            code: 'MR',
            display: 'Medical Record Number',
          }],
        },
        system: 'urn:oid:2.16.840.1.113883.19.5.99999.2',
        value: patient.mrn,
      },
      ...(patient.national_id ? [{
        use: 'official',
        type: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
            code: 'NI',
            display: 'National unique individual identifier',
          }],
        },
        system: 'urn:oid:2.16.840.1.113883.4.1',
        value: patient.national_id,
      }] : []),
    ],
    active: true,
    name: [{
      use: 'official',
      family: patient.last_name,
      given: [patient.first_name],
    }],
    telecom: [
      ...(patient.phone ? [{ system: 'phone', value: patient.phone, use: 'mobile' }] : []),
      ...(patient.email ? [{ system: 'email', value: patient.email }] : []),
    ],
    gender: patient.gender === 'male' ? 'male'
           : patient.gender === 'female' ? 'female'
           : 'unknown',
    birthDate: patient.dob ? String(patient.dob).slice(0, 10) : undefined,
    address: addr.line1 ? [{
      use: 'home',
      line: [addr.line1],
      city: addr.city,
      state: addr.state,
      postalCode: addr.pincode,
      country: 'IN',
    }] : [],
    extension: patient.blood_group ? [{
      url: 'http://hl7.org/fhir/StructureDefinition/patient-bloodType',
      valueCodeableConcept: {
        coding: [{
          system: 'http://snomed.info/sct',
          display: patient.blood_group,
        }],
        text: patient.blood_group,
      },
    }] : [],
  };
}

function buildFHIRPractitioner(provider) {
  return {
    resourceType: 'Practitioner',
    id: provider.provider_id,
    meta: { profile: ['http://hl7.org/fhir/StructureDefinition/Practitioner'] },
    identifier: [{
      system: 'urn:oid:2.16.840.1.113883.4.6',
      value: provider.license_number || provider.provider_code,
    }],
    active: true,
    name: [{
      use: 'official',
      text: provider.full_name,
      family: provider.full_name.split(' ').pop(),
      given: provider.full_name.split(' ').slice(0, -1),
    }],
    qualification: provider.specialty ? [{
      code: {
        coding: [{
          system: 'http://snomed.info/sct',
          display: provider.specialty,
        }],
        text: provider.specialty,
      },
    }] : [],
  };
}

function buildFHIRLocation(bed, ward) {
  return {
    resourceType: 'Location',
    id: bed.bed_id,
    meta: { profile: ['http://hl7.org/fhir/StructureDefinition/Location'] },
    identifier: [{
      system: 'urn:oid:2.16.840.1.113883.19.5.99999.3',
      value: bed.bed_number,
    }],
    status: bed.status === 'available' ? 'active' : 'active',
    name: `${bed.bed_number} — ${ward.ward_name}`,
    description: `${ward.ward_name} (${ward.ward_type})`,
    mode: 'instance',
    type: [{
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/v3-RoleCode',
        code: ward.ward_type === 'icu' ? 'ICU' : 'HU',
        display: ward.ward_type === 'icu' ? 'Intensive Care Unit' : 'Hospital Unit',
      }],
    }],
    physicalType: {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/location-physical-type',
        code: 'bd',
        display: 'Bed',
      }],
    },
    partOf: {
      reference: `Location/${ward.ward_id}`,
      display: ward.ward_name,
    },
  };
}

function buildFHIREncounter(admission, patient, provider, bed, ward, eventCode) {
  const statusMap = {
    admitted: 'in-progress',
    discharged: 'finished',
    transferred: 'in-progress',
    cancelled: 'cancelled',
  };

  const classMap = {
    emergency: { code: 'EMER', display: 'Emergency' },
    elective:  { code: 'IMP',  display: 'Inpatient' },
    day_care:  { code: 'AMB',  display: 'Ambulatory' },
    maternity: { code: 'IMP',  display: 'Inpatient' },
    transfer_in: { code: 'IMP', display: 'Inpatient' },
  };

  const cls = classMap[admission.admission_type] || { code: 'IMP', display: 'Inpatient' };

  return {
    resourceType: 'Encounter',
    id: admission.admission_id,
    meta: {
      profile: ['http://hl7.org/fhir/StructureDefinition/Encounter'],
      lastUpdated: new Date().toISOString(),
    },
    identifier: [{
      system: 'urn:oid:2.16.840.1.113883.19.5.99999.4',
      value: admission.admission_number,
    }],
    status: statusMap[admission.status] || 'in-progress',
    class: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: cls.code,
      display: cls.display,
    },
    type: [{
      coding: [{
        system: 'http://snomed.info/sct',
        code: '32485007',
        display: 'Hospital admission',
      }],
    }],
    serviceType: {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/service-type',
        code: '57',
        display: 'General Medicine',
      }],
    },
    subject: {
      reference: `Patient/${admission.patient_id}`,
      display: patient ? `${patient.first_name} ${patient.last_name}` : undefined,
    },
    participant: provider ? [{
      type: [{
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
          code: 'ATND',
          display: 'Attender',
        }],
      }],
      individual: {
        reference: `Practitioner/${admission.attending_provider_id}`,
        display: provider.full_name,
      },
    }] : [],
    period: {
      start: admission.admitted_at,
      ...(admission.status === 'discharged' ? { end: new Date().toISOString() } : {}),
    },
    reasonCode: admission.chief_complaint ? [{
      text: admission.chief_complaint,
    }] : [],
    diagnosis: admission.diagnosis_primary ? [{
      condition: { display: admission.diagnosis_primary },
      use: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/diagnosis-role',
          code: 'AD',
          display: 'Admission diagnosis',
        }],
      },
      rank: 1,
    }] : [],
    location: (bed && ward) ? [{
      location: {
        reference: `Location/${bed.bed_id}`,
        display: `${bed.bed_number} — ${ward.ward_name}`,
      },
      status: 'active',
      physicalType: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/location-physical-type',
          code: 'bd',
          display: 'Bed',
        }],
      },
    }] : [],
    hospitalization: {
      admitSource: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/admit-source',
          code: admission.admission_source || 'hosp-trans',
          display: admission.admission_source || 'Hospital Transfer',
        }],
      },
    },
  };
}

function buildFHIRMessageHeader(eventCode, eventDisplay, sender = 'MediCore HIS') {
  return {
    resourceType: 'MessageHeader',
    id: crypto.randomUUID(),
    meta: { profile: ['http://hl7.org/fhir/StructureDefinition/MessageHeader'] },
    eventCoding: {
      system: 'http://terminology.hl7.org/CodeSystem/v2-0003',
      code: eventCode,
      display: eventDisplay,
    },
    source: {
      name: sender,
      software: 'MediCore HIS v1.0',
      version: '1.0.0',
      endpoint: 'http://localhost:4000/api/hie',
    },
    destination: [{
      name: 'HIE Repository',
      endpoint: 'http://localhost:4000/api/hie/receive',
    }],
    sender: {
      display: sender,
    },
    timestamp: new Date().toISOString(),
  };
}

function buildFHIRServiceRequest(labOrder, patient, orderedBy) {
  return {
    resourceType: 'ServiceRequest',
    id: labOrder.lab_order_id,
    meta: { profile: ['http://hl7.org/fhir/StructureDefinition/ServiceRequest'] },
    identifier: [{
      system: 'urn:oid:2.16.840.1.113883.19.5.99999.5',
      value: labOrder.order_number,
    }],
    status: labOrder.order_status === 'resulted' ? 'completed' : 'active',
    intent: 'order',
    category: [{
      coding: [{
        system: 'http://snomed.info/sct',
        code: '108252007',
        display: 'Laboratory procedure',
      }],
    }],
    priority: labOrder.priority === 'stat' ? 'stat'
             : labOrder.priority === 'critical' ? 'urgent'
             : 'routine',
    subject: {
      reference: `Patient/${labOrder.patient_id}`,
    },
    encounter: {
      reference: `Encounter/${labOrder.admission_id}`,
    },
    requester: orderedBy ? {
      reference: `Practitioner/${orderedBy.provider_id}`,
      display: orderedBy.full_name,
    } : undefined,
    authoredOn: labOrder.ordered_at,
    note: labOrder.clinical_notes ? [{ text: labOrder.clinical_notes }] : [],
  };
}

function buildFHIRObservation(orderTest, result, labDef) {
  if (!result) {
    return {
      resourceType: 'Observation',
      id: orderTest.order_test_id,
      status: 'registered',
      code: {
        coding: [{
          system: 'http://loinc.org',
          code: labDef.loinc_code || 'unknown',
          display: labDef.test_name,
        }],
        text: labDef.test_name,
      },
      dataAbsentReason: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/data-absent-reason',
          code: 'not-performed',
          display: 'Not Performed',
        }],
      },
    };
  }

  const obs = {
    resourceType: 'Observation',
    id: result.result_id || orderTest.order_test_id,
    meta: { profile: ['http://hl7.org/fhir/StructureDefinition/Observation'] },
    status: result.result_status || 'final',
    category: [{
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/observation-category',
        code: 'laboratory',
        display: 'Laboratory',
      }],
    }],
    code: {
      coding: [{
        system: 'http://loinc.org',
        code: labDef.loinc_code || 'unknown',
        display: labDef.test_name,
      }],
      text: labDef.test_name,
    },
    effectiveDateTime: result.reported_at || new Date().toISOString(),
    issued: result.reported_at || new Date().toISOString(),
  };

  if (result.numeric_value !== null && result.numeric_value !== undefined) {
    obs.valueQuantity = {
      value: parseFloat(result.numeric_value),
      unit: result.unit || '',
      system: 'http://unitsofmeasure.org',
      code: result.unit || '',
    };
  } else if (result.text_value) {
    obs.valueString = result.text_value;
  }

  if (result.reference_range_low || result.reference_range_high) {
    obs.referenceRange = [{
      low: result.reference_range_low ? { value: parseFloat(result.reference_range_low), unit: result.unit || '' } : undefined,
      high: result.reference_range_high ? { value: parseFloat(result.reference_range_high), unit: result.unit || '' } : undefined,
    }];
  }

  if (result.abnormal_flag) {
    const flagMap = { H: 'H', HH: 'HH', L: 'L', LL: 'LL', A: 'A', POS: 'A', NEG: 'N', N: 'N' };
    obs.interpretation = [{
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
        code: flagMap[result.abnormal_flag] || result.abnormal_flag,
        display: result.abnormal_flag,
      }],
    }];
  }

  if (result.is_critical) {
    obs.extension = [{
      url: 'http://hl7.org/fhir/StructureDefinition/observation-critical',
      valueBoolean: true,
    }];
  }

  return obs;
}

function buildFHIRDiagnosticReport(labOrder, orderTests, results, labDefs, observations) {
  const statusMap = {
    pending:    'registered',
    collected:  'preliminary',
    processing: 'partial',
    resulted:   'final',
    cancelled:  'cancelled',
  };

  return {
    resourceType: 'DiagnosticReport',
    id: labOrder.lab_order_id,
    meta: { profile: ['http://hl7.org/fhir/StructureDefinition/DiagnosticReport'] },
    identifier: [{
      system: 'urn:oid:2.16.840.1.113883.19.5.99999.6',
      value: labOrder.order_number,
    }],
    basedOn: [{
      reference: `ServiceRequest/${labOrder.lab_order_id}`,
    }],
    status: statusMap[labOrder.order_status] || 'registered',
    category: [{
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/v2-0074',
        code: 'LAB',
        display: 'Laboratory',
      }],
    }],
    code: {
      coding: [{
        system: 'http://loinc.org',
        code: '11502-2',
        display: 'Laboratory report',
      }],
      text: `Lab Order ${labOrder.order_number}`,
    },
    subject: { reference: `Patient/${labOrder.patient_id}` },
    encounter: { reference: `Encounter/${labOrder.admission_id}` },
    effectiveDateTime: labOrder.ordered_at,
    issued: labOrder.results_received_at || labOrder.ordered_at,
    result: observations.map(obs => ({
      reference: `Observation/${obs.id}`,
      display: obs.code?.text || '',
    })),
    conclusion: labOrder.clinical_notes || '',
  };
}

// Build complete FHIR R4 Bundle
function buildFHIRBundle(messageType, resources, bundleType = 'message') {
  const bundleId = crypto.randomUUID();
  return {
    resourceType: 'Bundle',
    id: bundleId,
    meta: {
      profile: ['http://hl7.org/fhir/StructureDefinition/Bundle'],
      lastUpdated: new Date().toISOString(),
    },
    type: bundleType,
    timestamp: new Date().toISOString(),
    total: resources.length,
    entry: resources.map(resource => ({
      fullUrl: `urn:uuid:${resource.id || crypto.randomUUID()}`,
      resource,
      request: bundleType === 'transaction' ? {
        method: 'PUT',
        url: `${resource.resourceType}/${resource.id}`,
      } : undefined,
    })),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: fetch full admission context from DB
// ─────────────────────────────────────────────────────────────────────────────
async function fetchAdmissionContext(admissionId) {
  const [admRes, patRes, provRes, bedRes] = await Promise.all([
    pool.query('SELECT * FROM admissions WHERE admission_id=$1', [admissionId]),
    pool.query(`SELECT p.* FROM patients p JOIN admissions a ON a.patient_id=p.patient_id WHERE a.admission_id=$1`, [admissionId]),
    pool.query(`SELECT pr.* FROM providers pr JOIN admissions a ON a.attending_provider_id=pr.provider_id WHERE a.admission_id=$1`, [admissionId]),
    pool.query(`SELECT b.*, w.ward_name, w.ward_code, w.ward_type, w.department, w.ward_id
                FROM beds b JOIN wards w ON w.ward_id=b.ward_id
                JOIN admissions a ON a.bed_id=b.bed_id
                WHERE a.admission_id=$1`, [admissionId]),
  ]);
  return {
    admission: admRes.rows[0],
    patient:   patRes.rows[0],
    provider:  provRes.rows[0],
    bed:       bedRes.rows[0],
    ward:      bedRes.rows[0],  // same row has ward fields
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Route: GET /api/hie/messages — List HIE message log
// ─────────────────────────────────────────────────────────────────────────────
router.get('/messages', async (req, res, next) => {
  try {
    const { type, patient_id, limit = 50, offset = 0 } = req.query;
    let q = `SELECT l.*, p.first_name||' '||p.last_name AS patient_name, p.mrn,
                    a.admission_number, pr.full_name AS triggered_by_name
             FROM hie_message_log l
             LEFT JOIN patients p ON p.patient_id=l.patient_id
             LEFT JOIN admissions a ON a.admission_id=l.admission_id
             LEFT JOIN providers pr ON pr.provider_id=l.triggered_by
             WHERE 1=1`;
    const params = [];
    if (type) { params.push(type); q += ` AND l.message_type=$${params.length}`; }
    if (patient_id) { params.push(patient_id); q += ` AND l.patient_id=$${params.length}`; }
    params.push(parseInt(limit), parseInt(offset));
    q += ` ORDER BY l.sent_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;
    const { rows } = await pool.query(q, params);
    const { rows: [{ count }] } = await pool.query('SELECT COUNT(*) FROM hie_message_log');
    res.json({ messages: rows, total: parseInt(count) });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// Route: GET /api/hie/messages/:id — Get single message with full FHIR bundle
// ─────────────────────────────────────────────────────────────────────────────
router.get('/messages/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT l.*, p.first_name||' '||p.last_name AS patient_name, p.mrn
       FROM hie_message_log l
       LEFT JOIN patients p ON p.patient_id=l.patient_id
       WHERE l.log_id=$1`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Message not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// Route: POST /api/hie/adt — Generate + log ADT FHIR message
// eventType: ADMIT | TRANSFER | DISCHARGE
// ─────────────────────────────────────────────────────────────────────────────
router.post('/adt', async (req, res, next) => {
  try {
    const { admission_id, event_type, triggered_by, destination = 'internal' } = req.body;

    if (!admission_id || !event_type) {
      return res.status(400).json({ error: 'admission_id and event_type required' });
    }

    const ctx = await fetchAdmissionContext(admission_id);
    if (!ctx.admission) return res.status(404).json({ error: 'Admission not found' });

    const { admission, patient, provider, bed, ward } = ctx;

    // Map to HL7 ADT event codes
    const eventMap = {
      ADMIT:     { code: 'A01', display: 'ADT/ACK - Admit/visit notification',  type: 'ADT_A01' },
      TRANSFER:  { code: 'A02', display: 'ADT/ACK - Transfer a patient',         type: 'ADT_A02' },
      DISCHARGE: { code: 'A03', display: 'ADT/ACK - Discharge/end visit',        type: 'ADT_A03' },
    };

    const evt = eventMap[event_type];
    if (!evt) return res.status(400).json({ error: 'event_type must be ADMIT, TRANSFER, or DISCHARGE' });

    const messageHeader = buildFHIRMessageHeader(evt.code, evt.display);
    const fhirPatient   = buildFHIRPatient(patient);
    const fhirEncounter = buildFHIREncounter(admission, patient, provider, bed, ward, evt.code);
    const resources     = [messageHeader, fhirPatient, fhirEncounter];

    if (provider) resources.push(buildFHIRPractitioner(provider));
    if (bed && ward) resources.push(buildFHIRLocation(bed, ward));

    const bundle = buildFHIRBundle(evt.type, resources, 'message');

    // Persist to HIE log
    const { rows: [logged] } = await pool.query(
      `INSERT INTO hie_message_log
         (message_id, message_type, event_type, patient_id, admission_id,
          fhir_bundle, direction, status, destination, triggered_by)
       VALUES ($1,$2,$3,$4,$5,$6,'outbound','sent',$7,$8)
       RETURNING *`,
      [bundle.id, evt.type, event_type, patient.patient_id, admission_id,
       JSON.stringify(bundle), destination, triggered_by || null]
    );

    res.status(201).json({
      log_id:       logged.log_id,
      message_id:   bundle.id,
      message_type: evt.type,
      event_type,
      fhir_bundle:  bundle,
    });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// Route: POST /api/hie/lab-result — Generate + log ORU_R01 FHIR message
// ─────────────────────────────────────────────────────────────────────────────
router.post('/lab-result', async (req, res, next) => {
  try {
    const { lab_order_id, triggered_by } = req.body;
    if (!lab_order_id) return res.status(400).json({ error: 'lab_order_id required' });

    // Fetch lab order with tests and results
    const { rows: [labOrder] } = await pool.query(
      'SELECT * FROM lab_orders WHERE lab_order_id=$1', [lab_order_id]
    );
    if (!labOrder) return res.status(404).json({ error: 'Lab order not found' });

    const { rows: orderTests } = await pool.query(
      `SELECT lot.*, ltd.test_code, ltd.test_name, ltd.loinc_code, ltd.category, ltd.specimen_required
       FROM lab_order_tests lot
       JOIN lab_test_definitions ltd ON ltd.test_definition_id=lot.test_definition_id
       WHERE lot.lab_order_id=$1`, [lab_order_id]
    );

    const { rows: results } = await pool.query(
      `SELECT lr.*, lot.order_test_id as linked_ot
       FROM lab_results lr
       JOIN lab_order_tests lot ON lot.order_test_id=lr.order_test_id
       WHERE lot.lab_order_id=$1`, [lab_order_id]
    );

    const { rows: [patient] } = await pool.query(
      'SELECT * FROM patients WHERE patient_id=$1', [labOrder.patient_id]
    );
    const { rows: [orderedBy] } = await pool.query(
      'SELECT * FROM providers WHERE provider_id=$1', [labOrder.ordering_provider_id]
    );

    const resultMap = {};
    results.forEach(r => { resultMap[r.order_test_id] = r; });

    const observations = orderTests.map(ot =>
      buildFHIRObservation(ot, resultMap[ot.order_test_id] || null, ot)
    );

    const fhirPatient       = buildFHIRPatient(patient);
    const fhirServiceReq    = buildFHIRServiceRequest(labOrder, patient, orderedBy);
    const fhirDiagReport    = buildFHIRDiagnosticReport(labOrder, orderTests, results, orderTests, observations);
    const messageHeader     = buildFHIRMessageHeader('R01', 'ORU/ACK - Unsolicited transmission of an observation message');

    const resources = [messageHeader, fhirPatient, fhirServiceReq, fhirDiagReport, ...observations];
    const bundle    = buildFHIRBundle('ORU_R01', resources, 'message');

    const { rows: [logged] } = await pool.query(
      `INSERT INTO hie_message_log
         (message_id, message_type, event_type, patient_id, admission_id, lab_order_id,
          fhir_bundle, direction, status, destination, triggered_by)
       VALUES ($1,'ORU_R01','LAB_RESULT',$2,$3,$4,$5,'outbound','sent','internal',$6)
       RETURNING *`,
      [bundle.id, labOrder.patient_id, labOrder.admission_id, lab_order_id,
       JSON.stringify(bundle), triggered_by || null]
    );

    res.status(201).json({
      log_id:      logged.log_id,
      message_id:  bundle.id,
      fhir_bundle: bundle,
    });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// Route: GET /api/hie/fhir/Patient/:id — FHIR Patient resource
// ─────────────────────────────────────────────────────────────────────────────
router.get('/fhir/Patient/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM patients WHERE patient_id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Patient not found' });
    res.set('Content-Type', 'application/fhir+json');
    res.json(buildFHIRPatient(rows[0]));
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// Route: GET /api/hie/fhir/Encounter/:id — FHIR Encounter resource
// ─────────────────────────────────────────────────────────────────────────────
router.get('/fhir/Encounter/:id', async (req, res, next) => {
  try {
    const ctx = await fetchAdmissionContext(req.params.id);
    if (!ctx.admission) return res.status(404).json({ error: 'Encounter not found' });
    res.set('Content-Type', 'application/fhir+json');
    res.json(buildFHIREncounter(ctx.admission, ctx.patient, ctx.provider, ctx.bed, ctx.ward));
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// Route: GET /api/hie/fhir/DiagnosticReport/:id — FHIR DiagnosticReport
// ─────────────────────────────────────────────────────────────────────────────
router.get('/fhir/DiagnosticReport/:id', async (req, res, next) => {
  try {
    const { rows: [labOrder] } = await pool.query('SELECT * FROM lab_orders WHERE lab_order_id=$1', [req.params.id]);
    if (!labOrder) return res.status(404).json({ error: 'Lab order not found' });

    const { rows: orderTests } = await pool.query(
      `SELECT lot.*, ltd.test_code, ltd.test_name, ltd.loinc_code, ltd.category
       FROM lab_order_tests lot
       JOIN lab_test_definitions ltd ON ltd.test_definition_id=lot.test_definition_id
       WHERE lot.lab_order_id=$1`, [req.params.id]
    );
    const { rows: results } = await pool.query(
      `SELECT lr.* FROM lab_results lr
       JOIN lab_order_tests lot ON lot.order_test_id=lr.order_test_id
       WHERE lot.lab_order_id=$1`, [req.params.id]
    );
    const resultMap = {};
    results.forEach(r => { resultMap[r.order_test_id] = r; });
    const observations = orderTests.map(ot => buildFHIRObservation(ot, resultMap[ot.order_test_id] || null, ot));
    res.set('Content-Type', 'application/fhir+json');
    res.json(buildFHIRDiagnosticReport(labOrder, orderTests, results, orderTests, observations));
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// Route: GET /api/hie/stats — Summary stats for HIE dashboard
// ─────────────────────────────────────────────────────────────────────────────
router.get('/stats', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE message_type='ADT_A01') AS adt_admit,
        COUNT(*) FILTER (WHERE message_type='ADT_A02') AS adt_transfer,
        COUNT(*) FILTER (WHERE message_type='ADT_A03') AS adt_discharge,
        COUNT(*) FILTER (WHERE message_type='ORU_R01') AS oru_lab,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE direction='outbound') AS outbound,
        COUNT(*) FILTER (WHERE direction='inbound') AS inbound,
        COUNT(*) FILTER (WHERE status='error') AS errors
      FROM hie_message_log
    `);
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// Route: POST /api/hie/receive — Receive incoming FHIR Bundle (HIE Inbound)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/receive', async (req, res, next) => {
  try {
    const bundle = req.body;
    if (!bundle || bundle.resourceType !== 'Bundle') {
      return res.status(400).json({ error: 'Expected FHIR Bundle' });
    }
    await pool.query(
      `INSERT INTO hie_message_log
         (message_id, message_type, event_type, fhir_bundle, direction, status, source_system)
       VALUES ($1,'INBOUND','RECEIVED',$2,'inbound','received',$3)`,
      [bundle.id || crypto.randomUUID(), JSON.stringify(bundle), req.headers['x-source-system'] || 'External HIE']
    );
    res.json({ status: 'acknowledged', bundle_id: bundle.id });
  } catch (err) { next(err); }
});

export default router;
