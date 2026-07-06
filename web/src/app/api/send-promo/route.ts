import { getStatus, sendWAMessage, cleanPhone } from '@/lib/whatsapp';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const { connected } = getStatus();
  if (!connected) return NextResponse.json({ error: 'WhatsApp bot not connected' }, { status: 500 });
  try {
    const { phoneNumbers, messageText } = await req.json();
    for (const phone of phoneNumbers) {
      const id = `${cleanPhone(phone)}@s.whatsapp.net`;
      await sendWAMessage(id, { text: messageText });
      await new Promise(r => setTimeout(r, 500));
    }
    return NextResponse.json({ success: true, count: phoneNumbers.length });
  } catch (err: any) {
    console.error('[send-promo]', err);
    return NextResponse.json({ error: 'Failed to send promo' }, { status: 500 });
  }
}
