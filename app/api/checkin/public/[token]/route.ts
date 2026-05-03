/**
 * Endpoints PUBLICS (pas d'auth) pour le check-in client par QR.
 *
 * - GET : retourne le statut + (si cookie ddm_client_id valide) le client reconnu.
 * - POST : le client soumet son nom/téléphone OU confirme son identité reconnue.
 *
 * Cookie ddm_client_id : posé sur l'appareil du client la première fois qu'il s'inscrit.
 * Permet aux scans suivants de le reconnaître sans qu'il retape ses infos.
 *
 * Le matcher de middleware doit exclure /api/checkin/public/*.
 */

import { NextRequest, NextResponse } from 'next/server';
import { CheckinService } from '@/lib/modules/sales/checkin-service';
import { ClientService } from '@/lib/modules/sales/client-service';

const checkinService = new CheckinService();
const clientService = new ClientService();

const COOKIE_NAME = 'ddm_client_id';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 an

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const session = await checkinService.get(token);
  if (!session) {
    return NextResponse.json({ error: 'Session introuvable' }, { status: 404 });
  }

  let recognizedClient: { id: string; name: string; phone: string | null } | null = null;
  const cookieClientId = request.cookies.get(COOKIE_NAME)?.value;
  if (cookieClientId && session.status === 'pending') {
    try {
      const c = await clientService.getById(cookieClientId);
      if (c && c.workspaceId === session.workspaceId) {
        recognizedClient = { id: c.id, name: c.name, phone: c.phone };
      }
    } catch {
      /* cookie invalide, on ignore */
    }
  }

  return NextResponse.json({
    status: session.status,
    expiresAt: session.expiresAt,
    recognizedClient,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await request.json().catch(() => ({}));

    // Cas client revenant : confirmer son identité reconnue via cookie
    let existingClientId: string | undefined = body.existingClientId;
    if (!existingClientId && body.confirmRecognized) {
      existingClientId = request.cookies.get(COOKIE_NAME)?.value;
    }

    const session = await checkinService.complete(token, {
      name: body.name,
      phone: body.phone,
      existingClientId,
    });

    const response = NextResponse.json({
      status: session.status,
      clientId: session.clientId,
      clientName: session.clientName,
      clientPhone: session.clientPhone,
    });

    if (session.clientId) {
      response.cookies.set(COOKIE_NAME, session.clientId, {
        maxAge: COOKIE_MAX_AGE,
        path: '/',
        sameSite: 'lax',
        httpOnly: false,
      });
    }

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erreur' },
      { status: 400 }
    );
  }
}
