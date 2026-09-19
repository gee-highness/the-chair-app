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
import { verifyClaimSession } from '@/lib/customerAuth';

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
