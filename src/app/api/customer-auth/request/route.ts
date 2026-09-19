// src/app/api/customer-auth/request/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requestClaimCode } from '@/lib/customerAuth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ message: 'Email required' }, { status: 400 });

    const result = await requestClaimCode(email);

    // Same response whether or not the email matched a customer — no
    // enumeration signal either way.
    const response: Record<string, any> = { message: 'If that email has booked with us before, a code is on its way.' };

    // No email provider is wired in here (see customerAuth.ts) — log the
    // code server-side and, outside production only, hand it back directly
    // so the flow is testable end-to-end without one.
    if (result) {
      console.log(`[customer-auth] one-time code for ${email}: ${result.code}`);
      if (process.env.NODE_ENV !== 'production') {
        response.devCode = result.code;
      }
    }

    return NextResponse.json(response);
  } catch (error: any) {
    return NextResponse.json({ message: 'Failed to send code', error: error.message }, { status: 500 });
  }
}
