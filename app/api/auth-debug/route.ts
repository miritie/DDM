import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    DATABASE_URL: process.env.DATABASE_URL ? 'Configured ✅' : 'Missing ❌',
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'Missing ❌',
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? 'Configured ✅' : 'Missing ❌',
    DEFAULT_WORKSPACE_ID: process.env.DEFAULT_WORKSPACE_ID || 'Missing ❌',
    NODE_ENV: process.env.NODE_ENV
  });
}
