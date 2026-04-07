/**
 * ICD-11 Dataset Loader
 * ---------------------
 * Reads the official WHO ICD-11 SimpleTabulation CSV (or JSON) and
 * batch-inserts every code into the icd11_codes table.
 *
 * USAGE:
 *   node backend/scripts/load_icd11.js [path/to/file]
 *
 * DOWNLOAD THE DATA:
 *   1. Go to https://icd.who.int/browse/2024-01/mms/en
 *   2. Sign in (free WHO account)
 *   3. Download → "Linearization" → SimpleTabulation CSV
 *      or the full JSON linearization file
 *   4. Save as:  backend/scripts/icd11.csv   (CSV)
 *             or backend/scripts/icd11.json  (JSON)
 *
 * SUPPORTED FORMATS:
 *   CSV  — WHO SimpleTabulation with columns: Code, Title, [ParentCode], [Chapter]
 *   JSON — WHO Linearization JSON (array of { code, title, parent, chapter })
 *          or the official WHO API linearization export
 *
 * BATCH SIZE: 1 000 rows per INSERT for memory efficiency.
 */

import fs        from 'fs';
import path      from 'path';
import readline  from 'readline';
import { fileURLToPath } from 'url';
import pg        from 'pg';
import dotenv    from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BATCH_SIZE = 1000;

// ── Resolve file path ──────────────────────────────────────────
function resolveFilePath() {
  // Prefer explicit CLI argument
  if (process.argv[2]) return path.resolve(process.argv[2]);

  // Auto-detect common names in scripts/ or project root
  const candidates = [
    path.join(__dirname, 'icd11.csv'),
    path.join(__dirname, 'icd11.json'),
    path.join(__dirname, '../../icd11.csv'),
    path.join(__dirname, '../../icd11.json'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

// ── DB pool ────────────────────────────────────────────────────
const pool = new pg.Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'his_db_3',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

// ── CSV parser (handles quoted fields) ────────────────────────
function parseCSVLine(line) {
  const result = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { field += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(field); field = '';
    } else {
      field += ch;
    }
  }
  result.push(field);
  return result;
}

// ── Batch INSERT helper ────────────────────────────────────────
async function flushBatch(client, batch) {
  if (!batch.length) return;

  // Build: INSERT INTO icd11_codes (code, description, parent_code, category)
  //        VALUES ($1,$2,$3,$4), ($5,$6,$7,$8), ...
  //        ON CONFLICT (code) DO NOTHING
  const values = [];
  const placeholders = batch.map((row, i) => {
    const base = i * 4;
    values.push(row.code, row.description, row.parent_code || null, row.category || null);
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`;
  });

  await client.query(
    `INSERT INTO icd11_codes (code, description, parent_code, category)
     VALUES ${placeholders.join(', ')}
     ON CONFLICT (code) DO NOTHING`,
    values
  );
}

// ── CSV loader ─────────────────────────────────────────────────
async function loadCSV(filePath, client) {
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath),
    crlfDelay: Infinity,
  });

  let headers = null;
  let batch   = [];
  let total   = 0;

  // Common column name aliases (WHO files vary slightly between releases)
  const COL_CODE   = ['code', 'Code', 'CODE', 'ICD-11 Code', 'icd11code'];
  const COL_TITLE  = ['title', 'Title', 'TITLE', 'description', 'Description',
                      'FullDescription', 'LONG_TITLE'];
  const COL_PARENT = ['parentcode', 'ParentCode', 'parent_code', 'ParentId',
                      'parent', 'Parent'];
  const COL_CAT    = ['chapter', 'Chapter', 'ChapterNo', 'category',
                      'Category', 'block', 'Block'];

  function colIdx(names) {
    for (const n of names) {
      const i = headers.indexOf(n);
      if (i !== -1) return i;
    }
    return -1;
  }

  for await (const line of rl) {
    if (!line.trim()) continue;
    const parts = parseCSVLine(line);

    if (!headers) {
      headers = parts.map(h => h.trim());
      continue;
    }

    const ci = colIdx(COL_CODE);
    const ti = colIdx(COL_TITLE);
    if (ci === -1 || ti === -1) {
      console.error('❌ Cannot find Code or Title column in CSV headers:', headers);
      process.exit(1);
    }

    const pi = colIdx(COL_PARENT);
    const ai = colIdx(COL_CAT);

    const code        = (parts[ci] || '').trim();
    const description = (parts[ti] || '').trim();
    if (!code || !description) continue;

    batch.push({
      code,
      description,
      parent_code: pi !== -1 ? (parts[pi] || '').trim() || null : null,
      category:    ai !== -1 ? (parts[ai] || '').trim() || null : null,
    });

    if (batch.length >= BATCH_SIZE) {
      await flushBatch(client, batch);
      total += batch.length;
      batch = [];
      process.stdout.write(`\rInserted ${total.toLocaleString()} rows...`);
    }
  }

  // Final partial batch
  if (batch.length) {
    await flushBatch(client, batch);
    total += batch.length;
  }

  return total;
}

// ── JSON loader ────────────────────────────────────────────────
async function loadJSON(filePath, client) {
  const raw  = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(raw);

  // Support two common shapes:
  //   1. Array of objects: [{ code, title, parent, chapter }, ...]
  //   2. WHO linearization envelope: { linearizationEntities: [...] }
  const items = Array.isArray(data)
    ? data
    : (data.linearizationEntities || data.entities || data.codes || []);

  let batch = [];
  let total = 0;

  for (const item of items) {
    const code        = (item.code || item.icdCode || item.Code || '').trim();
    const description = (item.title || item.description || item.Title || item.name || '').trim();
    if (!code || !description) continue;

    batch.push({
      code,
      description,
      parent_code: item.parent      || item.parentCode  || item.parent_code  || null,
      category:    item.chapter     || item.chapterNo   || item.category     || null,
    });

    if (batch.length >= BATCH_SIZE) {
      await flushBatch(client, batch);
      total += batch.length;
      batch = [];
      process.stdout.write(`\rInserted ${total.toLocaleString()} rows...`);
    }
  }

  if (batch.length) {
    await flushBatch(client, batch);
    total += batch.length;
  }

  return total;
}

// ── Main ───────────────────────────────────────────────────────
async function run() {
  const filePath = resolveFilePath();
  if (!filePath) {
    console.error('❌  ICD-11 data file not found.');
    console.error('');
    console.error('Please download the WHO ICD-11 SimpleTabulation CSV from:');
    console.error('  https://icd.who.int/browse/2024-01/mms/en  →  Download → Linearization');
    console.error('');
    console.error('Then save it as one of:');
    console.error('  backend/scripts/icd11.csv');
    console.error('  backend/scripts/icd11.json');
    console.error('');
    console.error('Or pass the path directly:');
    console.error('  node backend/scripts/load_icd11.js /path/to/icd11.csv');
    process.exit(1);
  }

  const ext = path.extname(filePath).toLowerCase();
  console.log(`🚀 Loading ICD-11 data from: ${filePath}`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let total;
    if (ext === '.json') {
      total = await loadJSON(filePath, client);
    } else {
      total = await loadCSV(filePath, client);
    }

    await client.query('COMMIT');
    console.log(`\n✅  Done! Inserted ${total.toLocaleString()} ICD-11 codes.`);

    // Quick verification
    const { rows } = await client.query('SELECT COUNT(*) FROM icd11_codes');
    console.log(`📊  Total rows in icd11_codes: ${parseInt(rows[0].count).toLocaleString()}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌  Import failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

run();
