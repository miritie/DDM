/**
 * Erreurs API typées + handler centralisé.
 *
 * Avant : ~80 routes dupliquaient le même try/catch avec une détection
 * fragile `error.message?.includes('Permission') ? 403 : 500` — tout le
 * reste (validation, introuvable, non authentifié) partait en 500.
 *
 * Usage dans une route :
 *
 *   import { handleApiError, ValidationError, NotFoundError } from '@/lib/http/api-error';
 *
 *   export async function POST(request: NextRequest) {
 *     try {
 *       await requirePermission(PERMISSIONS.X);          // → 403 auto
 *       if (!body.outletId) throw new ValidationError('outletId requis');
 *       const item = await service.getById(id);
 *       if (!item) throw new NotFoundError('Vente non trouvée');
 *       return NextResponse.json({ data });
 *     } catch (error) {
 *       return handleApiError(error, 'Erreur lors de la création');
 *     }
 *   }
 *
 * Rétro-compatibilité : les erreurs non typées sont mappées par message
 * (« Permission refusée » → 403, « Non authentifié » → 401), donc les
 * services legacy qui lèvent des Error simples restent bien gérés.
 */

import { NextResponse } from 'next/server';

export class ApiError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(message: string, status = 500, details?: unknown) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.details = details;
  }
}

/** 400 — entrée invalide (body manquant, types incorrects, etc.) */
export class ValidationError extends ApiError {
  constructor(message: string, details?: unknown) {
    super(message, 400, details);
  }
}

/** 401 — non authentifié */
export class AuthenticationError extends ApiError {
  constructor(message = 'Non authentifié') {
    super(message, 401);
  }
}

/** 403 — authentifié mais permission manquante */
export class PermissionError extends ApiError {
  constructor(message: string) {
    super(message, 403);
  }
}

/** 404 — ressource introuvable */
export class NotFoundError extends ApiError {
  constructor(message: string) {
    super(message, 404);
  }
}

/** 409 — conflit d'état (déjà annulée, statut incompatible, etc.) */
export class ConflictError extends ApiError {
  constructor(message: string) {
    super(message, 409);
  }
}

/**
 * Convertit une erreur en réponse JSON avec le bon code HTTP.
 * Les 500 sont loggées (les 4xx sont des cas métier attendus).
 */
export function handleApiError(error: unknown, fallbackMessage = 'Erreur interne'): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        error: error.message,
        ...(error.details !== undefined ? { details: error.details } : {}),
      },
      { status: error.status }
    );
  }

  const message = error instanceof Error ? error.message : String(error);

  // Mapping legacy par message : services non migrés qui lèvent des Error simples.
  if (/permission(s)? refusée|permission requise/i.test(message)) {
    return NextResponse.json({ error: message }, { status: 403 });
  }
  if (message === 'Non authentifié') {
    return NextResponse.json({ error: message }, { status: 401 });
  }

  console.error('[api]', message, error instanceof Error ? error.stack : '');
  return NextResponse.json({ error: message || fallbackMessage }, { status: 500 });
}
