import makeWASocket, { useMultiFileAuthState, DisconnectReason, AnyMessageContent } from '@whiskeysockets/baileys';
import pino from 'pino';

type WASocket = ReturnType<typeof makeWASocket>;

declare global {
  // eslint-disable-next-line no-var
  var __waSock: WASocket | null;
  var __waQrCode: string | null;
  var __waConnecting: boolean;
  var __waInitialized: boolean;
}

if (!global.__waInitialized) {
  global.__waSock = null;
  global.__waQrCode = null;
  global.__waConnecting = false;
  global.__waInitialized = true;
  initWhatsApp();
}

export function getStatus() {
  return {
    connected: global.__waSock?.user ? true : false,
    qr: global.__waQrCode,
  };
}

export async function sendWAMessage(jid: string, content: AnyMessageContent) {
  if (!global.__waSock?.user) throw new Error('WhatsApp not connected');
  return global.__waSock.sendMessage(jid, content);
}

export function cleanPhone(phoneNumber: string) {
  return phoneNumber.replace(/\D/g, '');
}

async function initWhatsApp() {
  if (global.__waConnecting) return;
  global.__waConnecting = true;
  try {
    const { state, saveCreds } = await useMultiFileAuthState('baileys_auth_info');
    const sock = makeWASocket({
      auth: state,
      logger: pino({ level: 'silent' }),
    });
    global.__waSock = sock;
    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;
      if (qr) global.__waQrCode = qr;
      if (connection === 'close') {
        global.__waConnecting = false;
        global.__waSock = null;
        const code = (lastDisconnect?.error as any)?.output?.statusCode;
        if (code !== DisconnectReason.loggedOut) {
          setTimeout(initWhatsApp, 3000);
        } else {
          global.__waQrCode = null;
        }
      } else if (connection === 'open') {
        global.__waQrCode = null;
        global.__waConnecting = false;
      }
    });
  } catch (err) {
    console.error('[WhatsApp] Init error:', err);
    global.__waConnecting = false;
    setTimeout(initWhatsApp, 5000);
  }
}
