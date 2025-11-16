/**
 * API Route - Inscription d'un nouvel utilisateur
 */

import { NextRequest, NextResponse } from 'next/server';
import { AirtableClient } from '@/lib/airtable/client';
import { User } from '@/types/modules';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const airtableClient = new AirtableClient();

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
        { error: 'Le mot de passe doit contenir au moins 8 caractères' },
        { status: 400 }
      );
    }

    // Vérifier si l'email existe déjà
    const existingUsers = await airtableClient.list<User>('User', {
      filterByFormula: `{Email} = '${email}'`,
    });

    if (existingUsers.length > 0) {
      return NextResponse.json(
        { error: 'Cet email est déjà utilisé' },
        { status: 400 }
      );
    }

    // Hasher le mot de passe
    const passwordHash = await bcrypt.hash(password, 10);

    // Créer l'utilisateur
    const newUser: Partial<User> = {
      UserId: uuidv4(),
      Email: email,
      PasswordHash: passwordHash,
      FullName: fullName,
      DisplayName: fullName.split(' ')[0],
      WorkspaceId: process.env.DEFAULT_WORKSPACE_ID || 'workspace_default',
      RoleId: 'role_user', // Rôle par défaut
      IsActive: true,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };

    const user = await airtableClient.create<User>('User', newUser);

    return NextResponse.json({
      success: true,
      user: {
        userId: user.UserId,
        email: user.Email,
        fullName: user.FullName,
      },
    });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la création du compte' },
      { status: 500 }
    );
  }
}
