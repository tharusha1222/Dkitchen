import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const { phoneNumber, otp } = await req.json();

    if (!phoneNumber || !otp) {
      return NextResponse.json({ success: false, error: 'Phone number and OTP are required' }, { status: 400 });
    }

    // Initialize admin client to bypass RLS for reading/deleting OTPs
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 1. Verify OTP in DB
    const { data: otpData, error: otpError } = await supabaseAdmin
      .from('otps')
      .select('*')
      .eq('phone_number', phoneNumber)
      .eq('otp_code', otp)
      .single();

    if (otpError || !otpData) {
      return NextResponse.json({ success: false, error: 'Invalid OTP code. Please try again.' }, { status: 400 });
    }

    if (new Date(otpData.expires_at) < new Date()) {
      return NextResponse.json({ success: false, error: 'OTP has expired. Please request a new one.' }, { status: 400 });
    }

    // 2. Clear OTP
    await supabaseAdmin.from('otps').delete().eq('phone_number', phoneNumber);

    // Return success without creating a Supabase Auth user
    return NextResponse.json({ success: true, phone: phoneNumber });

  } catch (error: any) {
    console.error('[verify-otp]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
