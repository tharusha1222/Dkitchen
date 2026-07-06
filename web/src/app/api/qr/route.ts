import { getStatus } from '@/lib/whatsapp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const { connected, qr } = getStatus();
  if (connected) {
    return new Response('<h2 style="font-family:sans-serif;color:green;text-align:center;padding:2rem">✅ WhatsApp is connected!</h2>', {
      headers: { 'Content-Type': 'text/html' },
    });
  }
  if (!qr) {
    return new Response(`
      <html><head><meta http-equiv="refresh" content="3">
      <style>body{font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;background:#f5f5f5}</style></head>
      <body><h2>⏳ Waiting for QR code...</h2><p>This page will auto-refresh every 3 seconds.</p></body></html>
    `, { headers: { 'Content-Type': 'text/html' } });
  }
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`;
  return new Response(`
    <html><head><meta http-equiv="refresh" content="30">
    <style>body{font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;background:#f5f5f5}</style></head>
    <body>
      <h2>📱 Scan with WhatsApp</h2>
      <p>WhatsApp → Settings → Linked Devices → Link a Device</p>
      <img src="${qrImageUrl}" style="border:4px solid #25D366;border-radius:12px;padding:8px;background:white"/>
      <p style="color:#888;font-size:12px">QR refreshes every 30s</p>
    </body></html>
  `, { headers: { 'Content-Type': 'text/html' } });
}
