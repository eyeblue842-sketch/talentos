import { NextResponse } from 'next/server';
import { verifyBillingCheckoutPayment } from '@/lib/api';

export async function POST(request) {
  try {
    const payload = await request.json();
    const data = await verifyBillingCheckoutPayment(payload);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message, details: error.details },
      { status: error.statusCode || 500 }
    );
  }
}
