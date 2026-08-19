import { NextResponse } from 'next/server';
import { upsertBillingProfile } from '@/lib/api';

export async function PUT(request) {
  try {
    const payload = await request.json();
    const data = await upsertBillingProfile(payload);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message, details: error.details },
      { status: error.statusCode || 500 }
    );
  }
}
