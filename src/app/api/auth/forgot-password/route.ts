import { NextResponse } from 'next/server';
import { requestPasswordReset } from '@/lib/erp-db';
import { EmailConfigError, EmailDeliveryError } from '@/lib/email';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email address is required' }, { status: 400 });
    }

    let token: string | null = null;
    try {
      token = await requestPasswordReset(email);
    } catch (err: any) {
      // Configuration problem: return a clear 500
      if (err instanceof EmailConfigError || err?.isConfigError) {
        console.error('[API /api/auth/forgot-password] SMTP configuration error:', err);
        return NextResponse.json(
          { error: err.message || 'SMTP email service is not properly configured on the server.' },
          { status: 500 }
        );
      }
      // Email delivery failure: log server side, but return generic response to avoid account enumeration
      if (err instanceof EmailDeliveryError || err?.isDeliveryError) {
        console.error('[API /api/auth/forgot-password] Email delivery failure:', err);
        token = err.rawToken || null;
      } else {
        // Unexpected error (e.g. database error saving token)
        console.error('[API /api/auth/forgot-password] error:', err);
        return NextResponse.json({ error: 'Failed to process password recovery' }, { status: 500 });
      }
    }

    // Keep the response generic to prevent account enumeration. The token is only
    // returned in development so local tests can complete the flow without SMTP.
    return NextResponse.json({
      message: 'If the provided email is registered, a password recovery link has been generated.',
      debugToken: process.env.NODE_ENV !== 'production' && token ? token : undefined,
    });
  } catch (err: any) {
    console.error('[API /api/auth/forgot-password] request parsing error:', err);
    return NextResponse.json({ error: 'Failed to process password recovery' }, { status: 500 });
  }
}
