import { NextResponse } from 'next/server';
import { cancelBillingSubscription } from '@/lib/api';

export async function POST(request) {
  try {
    const { reason } = await request.json();
    const data = await cancelBillingSubscription(reason);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message, details: error.details },
      { status: error.statusCode || 500 }
    );
  }
}
