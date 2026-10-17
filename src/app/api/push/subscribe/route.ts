// Staff turn booking alerts on or off for one device. Scoped to the signed-in
// person and their salon; the tenant comes from the session, never the request.
import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { requireRole } from '@/lib/requireRole';
import { isPushConfigured, parseSubscription } from '@/lib/push';

export const dynamic = 'force-dynamic';

const STAFF = ['admin', 'receptionist', 'barber'];

export async function POST(req: NextRequest) {
  const session = await requireRole(req, STAFF);
  if (!session?.tenantId) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  if (!isPushConfigured()) return NextResponse.json({ message: 'Notifications are not set up on this server' }, { status: 503 });

  const sub = parseSubscription(await req.json().catch(() => null));
  if (!sub) return NextResponse.json({ message: 'Invalid subscription' }, { status: 400 });

  const db = await getDatabase();
  // One row per device (endpoint). A device that changes hands is re-pointed at the new person.
  await db.collection('pushSubscriptions').updateOne(
    { endpoint: sub.endpoint },
    {
      $set: {
        tenantId: session.tenantId,
        subjectId: session.subjectId,
        role: session.role,
        barberId: session.barberId ?? null,
        keys: sub.keys,
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true }
  );
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await requireRole(req, STAFF);
  if (!session?.tenantId) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (typeof body?.endpoint !== 'string') return NextResponse.json({ message: 'Invalid request' }, { status: 400 });

  const db = await getDatabase();
  // Only the owner of a subscription can remove it.
  await db.collection('pushSubscriptions').deleteOne({ endpoint: body.endpoint, subjectId: session.subjectId });
  return NextResponse.json({ ok: true });
}
