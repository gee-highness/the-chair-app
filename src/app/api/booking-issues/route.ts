// src/app/api/booking-issues/route.ts
//
// Bookings customers tried to make that could not go ahead. Staff list them
// (with the customer's contact details and what was in the way) and mark them
// resolved once sorted out. A barber only sees issues for their own bookings.
import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDatabase } from '@/lib/mongodb';
import { requireRole } from '@/lib/requireRole';
import { BookingIssue } from '@/lib/types';

export const dynamic = 'force-dynamic';

const ROLES = ['admin', 'receptionist', 'barber'];

function scope(session: { tenantId?: ObjectId; role: string; barberId?: ObjectId }) {
  const filter: Record<string, any> = { tenantId: session.tenantId };
  if (session.role === 'barber') filter.barberId = session.barberId;
  return filter;
}

export async function GET(req: NextRequest) {
  const session = await requireRole(req, ROLES);
  if (!session?.tenantId) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  if (session.role === 'barber' && !session.barberId) return NextResponse.json([]);

  try {
    const db = await getDatabase();
    const status = new URL(req.url).searchParams.get('status');
    const filter = scope(session);
    if (status === 'open' || status === 'resolved') filter.status = status;

    const issues = await db
      .collection<BookingIssue>('bookingIssues')
      .aggregate([
        { $match: filter },
        { $sort: { createdAt: -1 } },
        { $lookup: { from: 'barbers', localField: 'barberId', foreignField: '_id', as: 'barber' } },
        { $lookup: { from: 'services', localField: 'serviceId', foreignField: '_id', as: 'service' } },
        { $lookup: { from: 'appointments', localField: 'conflictAppointmentId', foreignField: '_id', as: 'conflict' } },
        {
          $addFields: {
            barberName: { $arrayElemAt: ['$barber.name', 0] },
            serviceName: { $arrayElemAt: ['$service.name', 0] },
            conflictDateTime: { $arrayElemAt: ['$conflict.dateTime', 0] },
            conflictStatus: { $arrayElemAt: ['$conflict.status', 0] },
          },
        },
        { $project: { barber: 0, service: 0, conflict: 0 } },
      ])
      .toArray();
    return NextResponse.json(issues.slice(0, 200));
  } catch (error: any) {
    return NextResponse.json({ message: 'Failed to fetch booking issues', error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await requireRole(req, ROLES);
  if (!session?.tenantId) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  if (session.role === 'barber' && !session.barberId) return NextResponse.json({ message: 'Booking issue not found' }, { status: 404 });

  try {
    const { _id, resolutionNote } = await req.json();
    if (!_id || !ObjectId.isValid(_id)) return NextResponse.json({ message: 'Missing booking issue ID' }, { status: 400 });

    const db = await getDatabase();
    const result = await db.collection<BookingIssue>('bookingIssues').updateOne(
      { ...scope(session), _id: new ObjectId(_id) },
      {
        $set: {
          status: 'resolved',
          resolvedAt: new Date(),
          resolvedBy: `${session.role}:${session.subjectId.toString()}`,
          ...(typeof resolutionNote === 'string' && resolutionNote.trim() ? { resolutionNote: resolutionNote.trim().slice(0, 500) } : {}),
        },
      }
    );
    if (result.matchedCount === 0) return NextResponse.json({ message: 'Booking issue not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ message: 'Failed to update booking issue', error: error.message }, { status: 500 });
  }
}
