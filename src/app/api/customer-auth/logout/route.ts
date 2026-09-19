// src/app/api/customer-auth/logout/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { deleteClaimSession } from '@/lib/customerAuth';

export async function POST(req: NextRequest) {
  await deleteClaimSession(req.cookies.get('customerClaim')?.value);
  const response = NextResponse.json({ message: 'Signed out' });
  response.cookies.delete('customerClaim');
  return response;
}
