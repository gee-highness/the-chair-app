// src/app/api/auth/verify/route.ts
import { NextResponse } from 'next/server';
import { verifySessionToken } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const cookie = request.headers.get('cookie') || '';
    const match = cookie.match(/session=([^;]+)/);
    const token = match?.[1];
    
    const session = await verifySessionToken(token);
    if (!session) {
      return NextResponse.json({ message: 'Invalid session' }, { status: 401 });
    }
    
    return NextResponse.json({
      role: session.role,
      subjectId: session.subjectId,
      subjectType: session.subjectType,
      tenantId: session.tenantId,
    });
  } catch (error: any) {
    console.error('Verify error:', error);
    return NextResponse.json(
      { message: 'Session verification failed', error: error.message },
      { status: 500 }
    );
  }
}
