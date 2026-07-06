import { getStatus, sendWAMessage, cleanPhone } from '@/lib/whatsapp';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const { connected } = getStatus();
  if (!connected) return NextResponse.json({ error: 'WhatsApp bot not connected' }, { status: 500 });
  try {
    const { phoneNumber, orderId, totalAmount, items, stallName } = await req.json();
    const id = `${cleanPhone(phoneNumber)}@s.whatsapp.net`;
    let itemLines = '';
    items?.forEach((item: any) => { itemLines += `\n• ${item.name} x${item.quantity}`; });
    const message = `🎉 *Your order is ready for collection!*\n\n📋 *Order #${orderId}*${itemLines}\n\n💰 *Total Paid: ${totalAmount}*\n📍 *Stall:* ${stallName || 'Campus Stall'}\n\nThank you for ordering! Enjoy your meal 🍽️`;
    await sendWAMessage(id, { text: message });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[send-receipt]', err);
    return NextResponse.json({ error: 'Failed to send receipt' }, { status: 500 });
  }
}
