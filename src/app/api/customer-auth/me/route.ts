// src/app/api/customer-auth/me/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyClaimSession } from '@/lib/customerAuth';
import { getDatabase } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const claim = await verifyClaimSession(req.cookies.get('customerClaim')?.value);
  if (!claim) return NextResponse.json({ message: 'Not signed in' }, { status: 401 });

  const db = await getDatabase();
  const customer = await db.collection('customers').findOne({ _id: claim.customerId }, { projection: { name: 1, email: 1 } });
  if (!customer) return NextResponse.json({ message: 'Not signed in' }, { status: 401 });

  return NextResponse.json({ customerId: customer._id, name: customer.name, email: customer.email });
}
