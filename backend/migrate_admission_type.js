import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'his_db_3',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

try {
  await pool.query(`ALTER TABLE admissions DROP CONSTRAINT IF EXISTS admissions_admission_type_check`);
  await pool.query(`ALTER TABLE admissions ADD CONSTRAINT admissions_admission_type_check CHECK (admission_type IN ('emergency', 'elective', 'maternity', 'day_care', 'transfer_in'))`);
  console.log('✅ Migration successful: admissions_admission_type_check updated');
} catch (err) {
  console.error('❌ Migration failed:', err.message);
} finally {
  await pool.end();
}
