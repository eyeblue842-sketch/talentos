import { NextResponse } from 'next/server';
import { createBillingPurchaseIntent } from '@/lib/api';

export async function POST(request) {
  try {
    const { productCode } = await request.json();
    const idempotencyKey = request.headers.get('idempotency-key') || undefined;
    const data = await createBillingPurchaseIntent(productCode, idempotencyKey);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message, details: error.details },
      { status: error.statusCode || 500 }
    );
  }
}
