/**
 * GET /api/scan/outlet/[qrToken]
 *   Endpoint PUBLIC (sans auth) — résout un QR token en infos outlet minimales
 *   pour la page de scan client. Renvoie 404 si token inconnu/inactif.
 */
import { NextRequest, NextResponse } from 'next/server';
import { OutletService } from '@/lib/modules/outlets/outlet-service';

const service = new OutletService();

export async function GET(_request: NextRequest, { params }: { params: Promise<{ qrToken: string }> }) {
  try {
    const { qrToken } = await params;
    const outlet = await service.getByQrToken(qrToken);
    if (!outlet || !outlet.IsActive) {
      return NextResponse.json({ error: 'Point de vente introuvable ou inactif' }, { status: 404 });
    }
    // Minimal: pas de manager_id, pas de gps
    return NextResponse.json({
      data: {
        id: outlet.id,
        Name: outlet.Name,
        Code: outlet.Code,
        City: outlet.City,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
