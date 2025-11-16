#!/usr/bin/env tsx
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const DATABASE_URL = process.env.DATABASE_URL;

console.log('DATABASE_URL exists:', !!DATABASE_URL);
console.log('DATABASE_URL preview:', DATABASE_URL?.substring(0, 60) + '...');

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function test() {
  try {
    const result = await pool.query('SELECT NOW() as time, version()');
    console.log('✅ Connection successful!');
    console.log('Time:', result.rows[0].time);
    console.log('Version:', result.rows[0].version.split(' ')[0]);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

test();
