// src/app/api/t/[tenantSlug]/my-appointments/route.ts
//
// This is what finally closes the "no customer-facing auth" gap Part 1's
// audit flagged as still open. Gated by the claim cookie from
// /api/customer-auth/* — never by requireRole, since a claim carries no
// staff role. Scoped to one tenant (from the URL slug) and one customer
// (from the claim), same populated-fields shape as the staff appointments
// list so the page rendering logic can be shared.
import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { resolveTenantBySlug } from '@/lib/resolveTenantBySlug';
import { ObjectId } from 'mongodb';
import { verifyClaimSession } from '@/lib/customerAuth';
import { sendBookingEmail } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const claim = await verifyClaimSession(req.cookies.get('customerClaim')?.value);
  if (!claim) return NextResponse.json({ message: 'Not signed in' }, { status: 401 });

  const { tenantSlug } = await params;
  const tenant = await resolveTenantBySlug(tenantSlug);
  if (!tenant) return NextResponse.json({ message: 'Salon not found' }, { status: 404 });

  try {
    const db = await getDatabase();
    const appointments = await db
      .collection('appointments')
      .aggregate([
        { $match: { tenantId: tenant._id, customerId: claim.customerId } },
        { $lookup: { from: 'barbers', localField: 'barberId', foreignField: '_id', as: 'barber' } },
        { $lookup: { from: 'services', localField: 'serviceId', foreignField: '_id', as: 'service' } },
        {
          $addFields: {
            barberName: { $arrayElemAt: ['$barber.name', 0] },
            serviceName: { $arrayElemAt: ['$service.name', 0] },
            servicePrice: { $arrayElemAt: ['$service.price', 0] },
            serviceDuration: { $arrayElemAt: ['$service.duration', 0] },
          },
        },
        { $project: { barber: 0, service: 0 } },
        { $sort: { dateTime: -1 } },
      ])
      .toArray();

    const customer = await db.collection('customers').findOne({ _id: claim.customerId }, { projection: { loyaltyPoints: 1 } });
    const loyaltyPoints = customer?.loyaltyPoints?.[tenant._id!.toString()] ?? 0;

    return NextResponse.json({ appointments, loyaltyPoints });
  } catch (error: any) {
    return NextResponse.json({ message: 'Failed to fetch appointments', error: error.message }, { status: 500 });
  }
}

/**
 * A customer cancels one of their own upcoming bookings. Only Pending or
 * Confirmed bookings in the future can be cancelled this way; anything else
 * (already done, already cancelled, in the past) is refused so history is
 * never rewritten. The booking must belong to this customer AND this salon.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const claim = await verifyClaimSession(req.cookies.get('customerClaim')?.value);
  if (!claim) return NextResponse.json({ message: 'Not signed in' }, { status: 401 });

  const { tenantSlug } = await params;
  const tenant = await resolveTenantBySlug(tenantSlug);
  if (!tenant) return NextResponse.json({ message: 'Salon not found' }, { status: 404 });

  let body: { appointmentId?: string; action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: 'Invalid request' }, { status: 400 });
  }
  if (body.action !== 'cancel' || !body.appointmentId || !ObjectId.isValid(body.appointmentId)) {
    return NextResponse.json({ message: 'Invalid request' }, { status: 400 });
  }

  try {
    const db = await getDatabase();
    const filter = {
      _id: new ObjectId(body.appointmentId),
      tenantId: tenant._id,
      customerId: claim.customerId,
    };
    const appt = await db.collection('appointments').findOne(filter);
    if (!appt) return NextResponse.json({ message: 'Appointment not found' }, { status: 404 });
    if (!['pending', 'confirmed'].includes(appt.status) || new Date(appt.dateTime) <= new Date()) {
      return NextResponse.json({ message: 'This booking can no longer be cancelled online. Please contact the salon.' }, { status: 409 });
    }

    await db.collection('appointments').updateOne(
      { ...filter, status: appt.status },
      {
        $set: { status: 'cancelled' },
        $push: { log: { timestamp: new Date(), action: 'status changed to cancelled', changedBy: `customer:${claim.customerId.toString()}` } } as any,
      }
    );

    // Tell the customer it went through (only when email is configured).
    const [customer, barber, service, settings] = await Promise.all([
      db.collection('customers').findOne({ _id: claim.customerId }, { projection: { name: 1, email: 1 } }),
      db.collection('barbers').findOne({ _id: appt.barberId }, { projection: { name: 1 } }),
      db.collection('services').findOne({ _id: appt.serviceId }, { projection: { name: 1 } }),
      db.collection('siteSettings').findOne({ tenantId: tenant._id }, { projection: { title: 1 } }),
    ]);
    if (customer?.email) {
      await sendBookingEmail({
        kind: 'cancelled',
        to: customer.email,
        customerName: customer.name || 'there',
        salonName: settings?.title || tenant.name,
        tenantSlug,
        serviceName: service?.name,
        barberName: barber?.name,
        dateTime: new Date(appt.dateTime),
      });
    }

    return NextResponse.json({ ok: true, status: 'cancelled' });
  } catch (error: any) {
    return NextResponse.json({ message: 'Failed to cancel appointment', error: error.message }, { status: 500 });
  }
}
