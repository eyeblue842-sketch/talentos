import { NextResponse } from 'next/server';
import { getSessionToken, requestBackend } from '@/lib/auth';

const actionPathMap = {
  addToAts: '/ats/resume-search/add',
  shortlist: '/ats/resume-search/shortlist',
  email: '/ats/resume-search/email',
  tag: '/ats/resume-search/tag',
};

export async function POST(request) {
  try {
    const token = await getSessionToken();
    if (!token) {
      return NextResponse.json({ success: false, message: 'Authentication required.' }, { status: 401 });
    }

    const body = await request.json();
    const path = actionPathMap[body.action];
    if (!path) {
      return NextResponse.json({ success: false, message: 'Unsupported resume search action.' }, { status: 422 });
    }

    const response = await requestBackend(path, {
      method: 'POST',
      body: JSON.stringify(body.payload || {}),
    }, token);

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message, details: error.details },
      { status: error.statusCode || 500 },
    );
  }
}
