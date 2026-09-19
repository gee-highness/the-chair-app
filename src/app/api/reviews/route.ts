// src/app/api/reviews/route.ts
//
// A review is only postable against a specific appointment the reviewer
// actually had (matched to their claim's customerId, tenant-scoped, and
// must be 'completed') — not a free-floating rating anyone can leave.
// reviews.appointmentId has a unique index (init-db.ts), so a second
// attempt on the same appointment is caught below as a friendly 409
// instead of a raw duplicate-key 500.
//
// GET/PUT (added for FIX_PLAN.md Priority 5 — review moderation): staff-only,
// admin-only, tenant-scoped. `status` is the only field a moderator may ever
// change — rating/text/author are the reviewer's own words, not staff's to
// edit.
import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { verifyClaimSession } from '@/lib/customerAuth';
import { requireRole } from '@/lib/requireRole';
import { Review } from '@/lib/types';
import { ObjectId, MongoServerError } from 'mongodb';

export const dynamic = 'force-dynamic';

const ALLOWED_STATUSES = ['visible', 'flagged'];

export async function GET(req: NextRequest) {
  const session = await requireRole(req, ['admin']);
  if (!session?.tenantId) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const db = await getDatabase();
    const reviews = await db
      .collection<Review>('reviews')
      .aggregate([
        { $match: { tenantId: session.tenantId } },
        { $lookup: { from: 'customers', localField: 'customerId', foreignField: '_id', as: 'customer' } },
        { $lookup: { from: 'barbers', localField: 'barberId', foreignField: '_id', as: 'barber' } },
        {
          $addFields: {
            customerName: { $arrayElemAt: ['$customer.name', 0] },
            barberName: { $arrayElemAt: ['$barber.name', 0] },
          },
        },
        { $project: { customer: 0, barber: 0 } },
        { $sort: { createdAt: -1 } },
      ])
      .toArray();

    return NextResponse.json(reviews);
  } catch (error: any) {
    return NextResponse.json({ message: 'Failed to fetch reviews', error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await requireRole(req, ['admin']);
  if (!session?.tenantId) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const { _id, status } = await req.json();
    if (!_id) return NextResponse.json({ message: 'Missing review ID' }, { status: 400 });
    if (!ALLOWED_STATUSES.includes(status)) {
      return NextResponse.json({ message: `status must be one of: ${ALLOWED_STATUSES.join(', ')}` }, { status: 400 });
    }

    const db = await getDatabase();
    const result = await db.collection<Review>('reviews').findOneAndUpdate(
      { _id: new ObjectId(_id), tenantId: session.tenantId },
      { $set: { status } },
      { returnDocument: 'after' }
    );

    if (!result) return NextResponse.json({ message: 'Review not found' }, { status: 404 });
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ message: 'Failed to update review', error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const claim = await verifyClaimSession(req.cookies.get('customerClaim')?.value);
  if (!claim) return NextResponse.json({ message: 'Sign in to leave a review' }, { status: 401 });

  try {
    const { appointmentId, rating, text } = await req.json();
    if (!appointmentId || !rating || rating < 1 || rating > 5) {
      return NextResponse.json({ message: 'A valid appointment and a 1-5 rating are required' }, { status: 400 });
    }

    const db = await getDatabase();
    const appointment = await db.collection('appointments').findOne({
      _id: new ObjectId(appointmentId),
      customerId: claim.customerId,
      status: 'completed',
    });
    if (!appointment) {
      return NextResponse.json({ message: 'That appointment was not found, or is not yet completed' }, { status: 400 });
    }

    const review: Review = {
      tenantId: appointment.tenantId,
      barberId: appointment.barberId,
      customerId: claim.customerId,
      appointmentId: appointment._id!,
      rating,
      text: text || undefined,
      status: 'visible',
      createdAt: new Date(),
    };

    const result = await db.collection<Review>('reviews').insertOne(review);
    return NextResponse.json({ _id: result.insertedId, ...review }, { status: 201 });
  } catch (error: any) {
    if (error instanceof MongoServerError && error.code === 11000) {
      return NextResponse.json({ message: 'You already reviewed this appointment' }, { status: 409 });
    }
    return NextResponse.json({ message: 'Failed to submit review', error: error.message }, { status: 500 });
  }
}
