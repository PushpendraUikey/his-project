import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const loincCSVPath = path.join(__dirname, '../../loinc.csv');

// Create a standalone pool for the script
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/medicore'
});

async function run() {
  if (!fs.existsSync(loincCSVPath)) {
    console.error(`❌ LOINC dataset not found at ${loincCSVPath}`);
    console.log('Please download it from https://loinc.org/downloads/ and save as loinc.csv in the root folder.');
    process.exit(1);
  }

  console.log('🚀 Starting LOINC dataset import...');
  const client = await pool.connect();

  try {
    const rl = readline.createInterface({
      input: fs.createReadStream(loincCSVPath),
      crlfDelay: Infinity
    });

    let headerSkipped = false;
    let headers = [];
    let count = 0;

    await client.query('BEGIN');

    // We can use COPY or individual inserts. Given it's a script, batched inserts is fine.
    // To handle standard CSV parsing with commas in quotes, we'll implement a simple regex tokenizer.
    
    // Quick regex to parse CSV line handling quotes:
    const regex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;

    for await (const line of rl) {
      const parts = line.split(regex).map(s => s.replace(/^"|"$/g, ''));
      if (!headerSkipped) {
        headers = parts;
        headerSkipped = true;
        continue;
      }

      // Identify positions from headers (usually LOINC_NUM, LONG_COMMON_NAME, SHORTNAME, CLASS)
      if (parts.length < 4) continue; // Skip malformed lines

      // In real LOINC CSV:
      // LOINC_NUM is usually index 0
      // COMPONENT is usually index 1
      // SHORTNAME is usually index 3
      // CLASS is usually index 4
      // LONG_COMMON_NAME is usually index 28 (it varies by version)

      // Let's do a safe mapping if we find standard headers or just use fixed indexes for standard loinc.csv
      const loincNumIdx = headers.indexOf('LOINC_NUM') > -1 ? headers.indexOf('LOINC_NUM') : 0;
      const longNameIdx = headers.indexOf('LONG_COMMON_NAME') > -1 ? headers.indexOf('LONG_COMMON_NAME') : 28;
      const shortNameIdx = headers.indexOf('SHORTNAME') > -1 ? headers.indexOf('SHORTNAME') : 3;
      const classIdx = headers.indexOf('CLASS') > -1 ? headers.indexOf('CLASS') : 4;

      const loinc_num = parts[loincNumIdx];
      let name = parts[longNameIdx] || parts[1]; // fallback to COMPONENT
      const short_name = parts[shortNameIdx];
      const cls = parts[classIdx];

      if (!loinc_num) continue;

      await client.query(
        `INSERT INTO loinc_codes (loinc_num, name, short_name, class) 
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (loinc_num) DO NOTHING`,
        [loinc_num, name, short_name, cls]
      );

      count++;
      if (count % 1000 === 0) {
        process.stdout.write(`\\rInserted ${count} rows...`);
      }
    }
    
    console.log(`\\n✅ Completed! Successfully inserted ${count} LOINC codes.`);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(`\\n❌ Error parsing LOINC dataset: ${e.message}`);
  } finally {
    client.release();
    pool.end();
  }
}

run();
