/**
 * API Route - Inscription d'un nouvel utilisateur
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPostgresClient } from '@/lib/database/postgres-client';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const postgresClient = getPostgresClient();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, fullName } = body;

    // Validation
    if (!email || !password || !fullName) {
      return NextResponse.json(
        { error: 'Tous les champs sont requis' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Le mot de passe doit contenir au moins 8 caracteres' },
        { status: 400 }
      );
    }

    // Verifier si l'email existe deja
    const existingUsers = await postgresClient.query(
      `SELECT * FROM users WHERE email = $1`,
      [email]
    );

    if (existingUsers.rows.length > 0) {
      return NextResponse.json(
        { error: 'Cet email est deja utilise' },
        { status: 400 }
      );
    }

    // Hasher le mot de passe
    const passwordHash = await bcrypt.hash(password, 10);

    // Creer l'utilisateur
    const userId = uuidv4();
    const now = new Date().toISOString();

    const users = await postgresClient.query(
      `INSERT INTO users (user_id, email, password_hash, full_name, display_name, workspace_id, role_id, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        userId,
        email,
        passwordHash,
        fullName,
        fullName.split(' ')[0],
        process.env.DEFAULT_WORKSPACE_ID || 'workspace_default',
        'role_user', // Role par defaut
        true,
        now,
        now,
      ]
    );

    const user = users.rows[0];

    return NextResponse.json({
      success: true,
      user: {
        userId: user.user_id,
        email: user.email,
        fullName: user.full_name,
      },
    });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la creation du compte' },
      { status: 500 }
    );
  }
}
