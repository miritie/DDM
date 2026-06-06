import { NextResponse } from 'next/server';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { handleApiError } from '@/lib/http/api-error';

export async function GET() {
  try {
    await requirePermission(PERMISSIONS.ADMIN_SETTINGS_VIEW);
  } catch (error) {
    return handleApiError(error);
  }
  return NextResponse.json({
    DATABASE_URL: process.env.DATABASE_URL ? 'Configured ✅' : 'Missing ❌',
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'Missing ❌',
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? 'Configured ✅' : 'Missing ❌',
    DEFAULT_WORKSPACE_ID: process.env.DEFAULT_WORKSPACE_ID || 'Missing ❌',
    NODE_ENV: process.env.NODE_ENV
  });
}
