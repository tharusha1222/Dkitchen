import { getStatus, sendWAMessage, cleanPhone } from '@/lib/whatsapp';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const { connected } = getStatus();
  if (!connected) return NextResponse.json({ error: 'WhatsApp bot not connected' }, { status: 500 });
  try {
    const { phoneNumber, name, qrToken, stallName, items, subtotal, discount, finalTotal, promoCode } = await req.json();
    const id = `${cleanPhone(phoneNumber)}@s.whatsapp.net`;
    const firstName = name ? name.split(' ')[0] : null;
    let orderLines = '';
    if (items?.length > 0) {
      items.forEach((item: any) => {
        orderLines += `\n• *${item.name}* x${item.quantity} — Rs. ${(item.price * item.quantity).toFixed(2)}`;
        item.accompaniments?.forEach((a: any) => {
          orderLines += `\n  ↳ ${a.name} ${a.price > 0 ? `(+Rs. ${Number(a.price).toFixed(2)})` : '(free)'}`;
        });
      });
    }
    let pricingLines = `\n\n💰 *Pricing Breakdown*\nSubtotal: Rs. ${Number(subtotal).toFixed(2)}`;
    if (promoCode && discount > 0) pricingLines += `\nDiscount (${promoCode}): -Rs. ${Number(discount).toFixed(2)}`;
    pricingLines += `\n*Total: Rs. ${Number(finalTotal).toFixed(2)}*`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrToken)}`;
    const greeting = firstName ? `Great news, *${firstName}*! 🎉` : '✅ *Order Confirmed!*';
    const caption = `${greeting}\n\n📋 *Your Order:*${orderLines}${pricingLines}\n\n📍 *Collect from:* ${stallName || 'the stall'}\n\nShow this QR code at the stall to collect your meal. Enjoy! 🍽️`;
    await sendWAMessage(id, { image: { url: qrUrl }, caption });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[send-qr]', err);
    return NextResponse.json({ error: 'Failed to send QR' }, { status: 500 });
  }
}
