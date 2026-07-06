import express from 'express';
import cors from 'cors';
import { makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import { createRequire } from 'module';


const app = express();
app.use(cors());
app.use(express.json());

let sock = null;
let qrCodeData = null;

async function connectToWhatsApp () {
    const { state, saveCreds } = await useMultiFileAuthState('baileys_auth_info');
    
    sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            qrCodeData = qr; // Save QR for the admin panel
        }

        if(connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('connection closed due to ', lastDisconnect.error, ', reconnecting ', shouldReconnect);
            if(shouldReconnect) {
                connectToWhatsApp();
            } else {
                console.log('Logged out from WhatsApp. Please delete auth folder and restart.');
                qrCodeData = null;
            }
        } else if(connection === 'open') {
            console.log('opened connection');
            qrCodeData = null; // Clear QR when connected
        }
    });

    sock.ev.on('messages.upsert', async m => {
        // Handle incoming messages if necessary
    });
}

connectToWhatsApp();

app.get('/status', (req, res) => {
    res.json({
        connected: sock?.user ? true : false,
        qr: qrCodeData
    });
});

app.get('/qr', (req, res) => {
    if (sock?.user) {
        return res.send('<h2 style="font-family:sans-serif;color:green">✅ WhatsApp is connected!</h2>');
    }
    if (!qrCodeData) {
        return res.send(`
            <html><head><meta http-equiv="refresh" content="3">
            <style>body{font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;background:#f5f5f5}</style></head>
            <body><h2>⏳ Waiting for QR code...</h2><p>This page will auto-refresh every 3 seconds.</p></body></html>
        `);
    }
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrCodeData)}`;
    res.send(`
        <html><head><meta http-equiv="refresh" content="30">
        <style>body{font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;background:#f5f5f5}</style></head>
        <body>
            <h2>📱 Scan with WhatsApp</h2>
            <p>WhatsApp → Settings → Linked Devices → Link a Device</p>
            <img src="${qrImageUrl}" style="border:4px solid #25D366;border-radius:12px;padding:8px;background:white"/>
            <p style="color:#888;font-size:12px">QR refreshes every 30s</p>
        </body></html>
    `);
});


app.post('/send-otp', async (req, res) => {
    const { phoneNumber, otp, name } = req.body;
    if (!sock?.user) return res.status(500).json({ error: 'WhatsApp bot not connected' });
    
    try {
        const cleanPhone = phoneNumber.replace(/\D/g, '');
        const id = `${cleanPhone}@s.whatsapp.net`;
        const firstName = name ? name.split(' ')[0] : null;
        console.log(`[BOT] Attempting to send OTP to: ${id}`);
        const greeting = firstName ? `Hey *${firstName}*! 👋` : 'Hello!';
        const message = `${greeting}\n\nYour DKitchen login code is:\n\n*${otp}*\n\nThis code expires in 10 minutes. Do not share it with anyone.`;
        await sock.sendMessage(id, { text: message });
        console.log(`[BOT] OTP sent successfully to: ${id}`);
        res.json({ success: true });
    } catch (error) {
        console.error('Error sending OTP:', error);
        res.status(500).json({ error: 'Failed to send OTP' });
    }
});

app.post('/send-receipt', async (req, res) => {
    const { phoneNumber, orderId, totalAmount, items, stallName } = req.body;
    if (!sock?.user) return res.status(500).json({ error: 'WhatsApp bot not connected' });

    try {
        const cleanPhone = phoneNumber.replace(/\D/g, '');
        const id = `${cleanPhone}@s.whatsapp.net`;

        let itemLines = '';
        if (items && items.length > 0) {
            items.forEach(item => {
                itemLines += `\n• ${item.name} x${item.quantity}`;
            });
        }

        const message =
`🎉 *Your order is ready for collection!*

📋 *Order #${orderId}*${itemLines}

💰 *Total Paid: ${totalAmount}*
📍 *Stall:* ${stallName || 'Campus Stall'}

Thank you for ordering! Enjoy your meal 🍽️`;

        await sock.sendMessage(id, { text: message });
        res.json({ success: true });
    } catch (error) {
        console.error('Error sending receipt:', error);
        res.status(500).json({ error: 'Failed to send receipt' });
    }
});


app.post('/send-qr', async (req, res) => {
    const { phoneNumber, name, qrToken, stallName, items, subtotal, discount, finalTotal, promoCode } = req.body;
    if (!sock?.user) return res.status(500).json({ error: 'WhatsApp bot not connected' });

    try {
        const cleanPhone = phoneNumber.replace(/\D/g, '');
        const id = `${cleanPhone}@s.whatsapp.net`;
        const firstName = name ? name.split(' ')[0] : null;
        console.log(`[BOT] Attempting to send QR to: ${id}`);

        // Build detailed order summary
        let orderLines = '';
        if (items && items.length > 0) {
            items.forEach(item => {
                const itemTotal = (item.price * item.quantity).toFixed(2);
                orderLines += `\n• *${item.name}* x${item.quantity} — Rs. ${itemTotal}`;
                if (item.accompaniments && item.accompaniments.length > 0) {
                    item.accompaniments.forEach(a => {
                        const accompLine = a.price > 0 ? `  ↳ ${a.name} (+Rs. ${Number(a.price).toFixed(2)})` : `  ↳ ${a.name} (free)`;
                        orderLines += `\n${accompLine}`;
                    });
                }
            });
        }

        let pricingLines = `\n\n💰 *Pricing Breakdown*`;
        pricingLines += `\nSubtotal: Rs. ${Number(subtotal).toFixed(2)}`;
        if (promoCode && discount > 0) {
            pricingLines += `\nDiscount (${promoCode}): -Rs. ${Number(discount).toFixed(2)}`;
        }
        pricingLines += `\n*Total: Rs. ${Number(finalTotal).toFixed(2)}*`;

        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrToken)}`;
        const personalGreeting = firstName ? `Great news, *${firstName}*! 🎉` : '✅ *Order Confirmed!*';
        const caption = 
`${personalGreeting}

📋 *Your Order:*${orderLines}${pricingLines}

📍 *Collect from:* ${stallName || 'the stall'}

Show this QR code at the stall to collect your meal. Enjoy! 🍽️`;

        await sock.sendMessage(id, { 
            image: { url: qrUrl },
            caption
        });
        console.log(`[BOT] QR sent successfully to: ${id}`);
        res.json({ success: true });
    } catch (error) {
        console.error('Error sending QR code:', error);
        res.status(500).json({ error: 'Failed to send QR code' });
    }
});


app.post('/send-promo', async (req, res) => {
    const { phoneNumbers, messageText } = req.body;
    if (!sock?.user) return res.status(500).json({ error: 'WhatsApp bot not connected' });

    try {
        for (const phone of phoneNumbers) {
            const cleanPhone = phone.replace(/\D/g, '');
            const id = `${cleanPhone}@s.whatsapp.net`;
            await sock.sendMessage(id, { text: messageText });
            // Add a small delay to avoid rate limits
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        res.json({ success: true, count: phoneNumbers.length });
    } catch (error) {
        console.error('Error sending promo:', error);
        res.status(500).json({ error: 'Failed to send promo blasts' });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`WhatsApp Bot API running on port ${PORT}`);
});
