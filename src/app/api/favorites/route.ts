// src/app/api/favorites/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { verifyClaimSession } from '@/lib/customerAuth';
import { Favorite } from '@/lib/types';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const claim = await verifyClaimSession(req.cookies.get('customerClaim')?.value);
  if (!claim) return NextResponse.json({ message: 'Not signed in' }, { status: 401 });

  const db = await getDatabase();
  const favorites = await db
    .collection<Favorite>('favorites')
    .aggregate([
      { $match: { customerId: claim.customerId } },
      { $lookup: { from: 'tenants', localField: 'tenantId', foreignField: '_id', as: 'tenant' } },
      { $unwind: '$tenant' },
      { $project: { tenantId: 1, name: '$tenant.name', slug: '$tenant.slug', branding: '$tenant.branding' } },
    ])
    .toArray();

  return NextResponse.json(favorites);
}

export async function POST(req: NextRequest) {
  const claim = await verifyClaimSession(req.cookies.get('customerClaim')?.value);
  if (!claim) return NextResponse.json({ message: 'Sign in to save favorites' }, { status: 401 });

  const { tenantId } = await req.json();
  if (!tenantId) return NextResponse.json({ message: 'tenantId required' }, { status: 400 });

  const db = await getDatabase();
  await db.collection<Favorite>('favorites').updateOne(
    { customerId: claim.customerId, tenantId: new ObjectId(tenantId) },
    { $setOnInsert: { customerId: claim.customerId, tenantId: new ObjectId(tenantId), createdAt: new Date() } },
    { upsert: true }
  );
  return NextResponse.json({ message: 'Saved' }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const claim = await verifyClaimSession(req.cookies.get('customerClaim')?.value);
  if (!claim) return NextResponse.json({ message: 'Not signed in' }, { status: 401 });

  const tenantId = req.nextUrl.searchParams.get('tenantId');
  if (!tenantId) return NextResponse.json({ message: 'tenantId required' }, { status: 400 });

  const db = await getDatabase();
  await db.collection('favorites').deleteOne({ customerId: claim.customerId, tenantId: new ObjectId(tenantId) });
  return NextResponse.json({ message: 'Removed' });
}
