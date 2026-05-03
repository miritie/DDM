/**
 * POST /api/scan/push  body: { qrToken, name?, phone?, clientId? }
 *   Endpoint PUBLIC (sans auth) — un client scanne le QR du stand, ses infos sont
 *   ajoutées à la file d'attente d'attribution de l'outlet (TTL 10 min).
 *   Si un clientId existant est fourni, on l'utilise. Sinon les infos sont stockées
 *   en snapshot (le commercial créera/matchera côté POS).
 */
import { NextRequest, NextResponse } from 'next/server';
import { OutletService } from '@/lib/modules/outlets/outlet-service';
import { ScanQueueService } from '@/lib/modules/outlets/scan-queue-service';

const outletService = new OutletService();
const scanQueue = new ScanQueueService();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { qrToken, name, phone, clientId } = body;

    if (!qrToken) {
      return NextResponse.json({ error: 'qrToken requis' }, { status: 400 });
    }
    if (!name && !phone && !clientId) {
      return NextResponse.json({ error: 'Au moins un identifiant client requis (name, phone ou clientId)' }, { status: 400 });
    }

    const outlet = await outletService.getByQrToken(qrToken);
    if (!outlet || !outlet.IsActive) {
      return NextResponse.json({ error: 'Point de vente introuvable ou inactif' }, { status: 404 });
    }

    const scan = await scanQueue.push({
      workspaceId: outlet.WorkspaceId,
      outletId: outlet.id!,
      clientId,
      clientName: name,
      clientPhone: phone,
    });

    return NextResponse.json({
      data: {
        id: scan.id,
        outletName: outlet.Name,
        expiresAt: scan.ExpiresAt,
      },
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
