import { NextResponse } from 'next/server';
import { getPostgresClient } from '@/lib/database/postgres-client';

export async function GET() {
  try {
    const dbClient = getPostgresClient();

    const result = await dbClient.query('SELECT NOW() as time, COUNT(*) as user_count FROM users');

    return NextResponse.json({
      success: true,
      time: result.rows[0].time,
      userCount: result.rows[0].user_count,
      databaseUrl: process.env.DATABASE_URL ? 'Configured' : 'Missing'
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      databaseUrl: process.env.DATABASE_URL ? 'Configured' : 'Missing'
    }, { status: 500 });
  }
}
