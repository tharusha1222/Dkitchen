import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const { phoneNumber, otp, fullName } = await req.json();

    if (!phoneNumber || !otp) {
      return NextResponse.json({ success: false, error: 'Phone number and OTP are required' }, { status: 400 });
    }

    // Initialize admin client
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

    // 3. Generate a secure temporary password
    const tempPassword = `DKitchen!${Math.random().toString(36).substring(2, 15)}${Date.now()}`;

    let userId: string | null = null;

    // 4. Create or Update user in auth.users
    const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      phone: phoneNumber,
      password: tempPassword,
      phone_confirm: true,
      user_metadata: { full_name: fullName }
    });

    if (createError && createError.message.includes('already exists')) {
      // User already exists, fetch their ID from profiles
      const { data: profile } = await supabaseAdmin.from('profiles').select('id').eq('phone_number', phoneNumber).single();
      if (profile) {
        userId = profile.id;
        // Force update their password to the new temp password so we can sign in
        await supabaseAdmin.auth.admin.updateUserById(userId as string, { password: tempPassword });
      } else {
        return NextResponse.json({ success: false, error: 'Database integrity error: User exists in auth but not in profiles' }, { status: 500 });
      }
    } else if (createError) {
      return NextResponse.json({ success: false, error: createError.message }, { status: 500 });
    } else if (createData?.user) {
      userId = createData.user.id;
      // Also upsert into profiles
      await supabaseAdmin.from('profiles').upsert({
        id: userId,
        phone_number: phoneNumber,
        full_name: fullName,
        role: 'student'
      });
    }

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Failed to resolve user ID' }, { status: 500 });
    }

    // Return the phone and temp password to the frontend
    // The frontend will use supabase.auth.signInWithPassword({ phone, password })
    return NextResponse.json({ 
      success: true, 
      phone: phoneNumber, 
      password: tempPassword 
    });

  } catch (error: any) {
    console.error('[verify-otp]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
