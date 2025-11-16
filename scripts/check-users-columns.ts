import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '/Volumes/DATA/DEVS/DDM/.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.query('SELECT column_name FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position', ['users'])
  .then(r => {
    console.log('Users table columns:');
    r.rows.forEach((row, i) => console.log(`  ${i + 1}. ${row.column_name}`));
    pool.end();
  });
