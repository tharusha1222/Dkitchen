import { getStatus, sendWAMessage, cleanPhone } from '@/lib/whatsapp';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const { connected } = getStatus();
  if (!connected) return NextResponse.json({ error: 'WhatsApp bot not connected' }, { status: 500 });
  try {
    const { phoneNumber, otp, name } = await req.json();
    const id = `${cleanPhone(phoneNumber)}@s.whatsapp.net`;
    const firstName = name ? name.split(' ')[0] : null;
    const greeting = firstName ? `Hey *${firstName}*! 👋` : 'Hello!';
    const message = `${greeting}\n\nYour DKitchen login code is:\n\n*${otp}*\n\nThis code expires in 10 minutes. Do not share it with anyone.`;
    await sendWAMessage(id, { text: message });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[send-otp]', err);
    return NextResponse.json({ error: 'Failed to send OTP' }, { status: 500 });
  }
}
