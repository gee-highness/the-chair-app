// The public VAPID key the browser needs to subscribe, or null when push is not configured.
import { NextResponse } from 'next/server';
import { pushPublicKey } from '@/lib/push';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ publicKey: pushPublicKey() });
}
