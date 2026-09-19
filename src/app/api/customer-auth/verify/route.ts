// src/app/api/customer-auth/verify/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyClaimCode } from '@/lib/customerAuth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { email, code } = await req.json();
    if (!email || !code) return NextResponse.json({ message: 'Email and code required' }, { status: 400 });

    const result = await verifyClaimCode(email, code);
    if (!result) return NextResponse.json({ message: 'That code is invalid or has expired' }, { status: 401 });

    const response = NextResponse.json({ message: 'Signed in' });
    response.cookies.set('customerClaim', result.rawToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60,
      path: '/',
    });
    return response;
  } catch (error: any) {
    return NextResponse.json({ message: 'Verification failed', error: error.message }, { status: 500 });
  }
}
