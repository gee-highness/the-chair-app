// src/app/api/services/route.ts
//
// Staff-facing CRUD for a tenant's services. Tenant scoping comes from the
// authenticated session (session.tenantId), never from a client-supplied
// header — see src/lib/requireRole.ts. Public/unauthenticated browsing of a
// tenant's services (for the booking flow) goes through
// /api/public/tenants/[slug] instead, which is explicitly designed for that.
import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { requireRole } from '@/lib/requireRole';
import { Service } from '@/lib/types';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

const ALLOWED_UPDATE_FIELDS = ['name', 'duration', 'price', 'description', 'imageUrl', 'categoryId'];

export async function GET(req: NextRequest) {
  const session = await requireRole(req, ['admin', 'receptionist', 'barber']);
  if (!session?.tenantId) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const db = await getDatabase();
    const services = await db
      .collection<Service>('services')
      .find({ tenantId: session.tenantId })
      .toArray();

    return NextResponse.json(services);
  } catch (error: any) {
    return NextResponse.json({ message: 'Failed to fetch services', error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await requireRole(req, ['admin']);
  if (!session?.tenantId) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { name, duration, price, description, imageUrl, categoryId } = body;

    if (!name || !duration || price === undefined) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }

    const db = await getDatabase();
    const service: Service = {
      tenantId: session.tenantId,
      name,
      duration,
      price,
      description,
      imageUrl,
      categoryId: categoryId ? new ObjectId(categoryId) : undefined,
    };

    const result = await db.collection<Service>('services').insertOne(service);
    return NextResponse.json({ _id: result.insertedId, ...service }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ message: 'Failed to create service', error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await requireRole(req, ['admin']);
  if (!session?.tenantId) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { _id, ...rest } = body;

    if (!_id) return NextResponse.json({ message: 'Missing service ID' }, { status: 400 });

    const updates: Record<string, any> = {};
    for (const key of ALLOWED_UPDATE_FIELDS) {
      if (key in rest) updates[key] = rest[key];
    }
    if (updates.categoryId) updates.categoryId = new ObjectId(updates.categoryId);

    const db = await getDatabase();
    const result = await db.collection<Service>('services').findOneAndUpdate(
      // Scoped to the caller's own tenant — prevents editing another tenant's service by _id.
      { _id: new ObjectId(_id), tenantId: session.tenantId },
      { $set: updates },
      { returnDocument: 'after' }
    );

    if (!result) return NextResponse.json({ message: 'Service not found' }, { status: 404 });
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ message: 'Failed to update service', error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await requireRole(req, ['admin']);
  if (!session?.tenantId) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ message: 'Missing service ID' }, { status: 400 });

    const db = await getDatabase();
    const serviceId = new ObjectId(id);

    // Don't delete a service with upcoming appointments still booked
    // against it — completed/cancelled history is fine to leave orphaned
    // by name, but an upcoming booking must not silently lose its service.
    const upcoming = await db.collection('appointments').countDocuments({
      tenantId: session.tenantId,
      serviceId,
      status: { $in: ['pending', 'confirmed', 'waitlist'] },
      dateTime: { $gt: new Date() },
    });
    if (upcoming > 0) {
      return NextResponse.json({ message: `${upcoming} upcoming appointment(s) use this service` }, { status: 409 });
    }

    const result = await db.collection<Service>('services').deleteOne({ _id: serviceId, tenantId: session.tenantId });
    if (result.deletedCount === 0) return NextResponse.json({ message: 'Service not found' }, { status: 404 });
    return NextResponse.json({ message: 'Deleted' });
  } catch (error: any) {
    return NextResponse.json({ message: 'Failed to delete service', error: error.message }, { status: 500 });
  }
}
