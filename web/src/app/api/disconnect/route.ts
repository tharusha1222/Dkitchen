import { disconnectWhatsApp, getStatus } from '@/lib/whatsapp';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST() {
  const { connected } = getStatus();
  if (!connected) return NextResponse.json({ error: 'WhatsApp bot not connected' }, { status: 400 });
  
  try {
    await disconnectWhatsApp();
    return NextResponse.json({ success: true, message: 'Disconnected successfully. Generating new QR...' });
  } catch (err: any) {
    console.error('[disconnect]', err);
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
  }
}
