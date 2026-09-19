// src/app/api/barbers/route.ts
//
// Staff-facing CRUD for a tenant's barbers. Tenant scoping comes from the
// authenticated session — see src/lib/requireRole.ts. Public browsing (for
// the booking flow) goes through /api/public/tenants/[slug] instead.
import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { requireRole } from '@/lib/requireRole';
import { Barber } from '@/lib/types';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

const ALLOWED_UPDATE_FIELDS = ['name', 'slug', 'bio', 'imageUrl', 'dailyAvailability', 'portfolio', 'tags'];

export async function GET(req: NextRequest) {
  const session = await requireRole(req, ['admin', 'receptionist', 'barber']);
  if (!session?.tenantId) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = await getDatabase();
    const barbers = await db
      .collection<Barber>('barbers')
      .find({ tenantId: session.tenantId })
      .toArray();

    return NextResponse.json(barbers);
  } catch (error: any) {
    console.error('GET /api/barbers error:', error);
    return NextResponse.json({ message: 'Failed to fetch barbers', error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await requireRole(req, ['admin']);
  if (!session?.tenantId) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { name, slug, bio, imageUrl, dailyAvailability, portfolio, tags } = body;

    if (!name || !slug || !dailyAvailability) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }

    const db = await getDatabase();
    const barber: Barber = {
      tenantId: session.tenantId,
      name,
      slug,
      bio,
      imageUrl,
      dailyAvailability,
      portfolio,
      tags,
    };

    const result = await db.collection<Barber>('barbers').insertOne(barber);
    return NextResponse.json({ _id: result.insertedId, ...barber }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/barbers error:', error);
    return NextResponse.json({ message: 'Failed to create barber', error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await requireRole(req, ['admin']);
  if (!session?.tenantId) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { _id, ...rest } = body;

    if (!_id) {
      return NextResponse.json({ message: 'Missing barber ID' }, { status: 400 });
    }

    const updates: Record<string, any> = {};
    for (const key of ALLOWED_UPDATE_FIELDS) {
      if (key in rest) updates[key] = rest[key];
    }

    const db = await getDatabase();
    const result = await db.collection<Barber>('barbers').findOneAndUpdate(
      { _id: new ObjectId(_id), tenantId: session.tenantId },
      { $set: updates },
      { returnDocument: 'after' }
    );

    if (!result) {
      return NextResponse.json({ message: 'Barber not found' }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('PUT /api/barbers error:', error);
    return NextResponse.json({ message: 'Failed to update barber', error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await requireRole(req, ['admin']);
  if (!session?.tenantId) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ message: 'Missing barber ID' }, { status: 400 });

    const db = await getDatabase();
    const barberId = new ObjectId(id);

    const upcoming = await db.collection('appointments').countDocuments({
      tenantId: session.tenantId,
      barberId,
      status: { $in: ['pending', 'confirmed', 'waitlist'] },
      dateTime: { $gt: new Date() },
    });
    if (upcoming > 0) {
      return NextResponse.json({ message: `${upcoming} upcoming appointment(s) assigned to this barber` }, { status: 409 });
    }

    const result = await db.collection<Barber>('barbers').deleteOne({ _id: barberId, tenantId: session.tenantId });
    if (result.deletedCount === 0) return NextResponse.json({ message: 'Barber not found' }, { status: 404 });
    return NextResponse.json({ message: 'Deleted' });
  } catch (error: any) {
    console.error('DELETE /api/barbers error:', error);
    return NextResponse.json({ message: 'Failed to delete barber', error: error.message }, { status: 500 });
  }
}
