// src/app/api/auth/logout/route.ts
import { NextResponse } from 'next/server';
import { deleteSession } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const cookie = request.headers.get('cookie') || '';
    const match = cookie.match(/session=([^;]+)/);
    const token = match?.[1];
    
    await deleteSession(token);
    
    const response = NextResponse.json({ message: 'Logged out' });
    response.cookies.delete('session');
    return response;
  } catch (error: any) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { message: 'Logout failed', error: error.message },
      { status: 500 }
    );
  }
}
