import makeWASocket, { useMultiFileAuthState, DisconnectReason, makeCacheableSignalKeyStore } from "@whiskeysockets/baileys";
import qrcode from "qrcode-terminal";
import pino from "pino";
import fs from "fs";

const GROUP_NAME = "שיחה עם אלירן";

function loadResponses() {
    try {
        return JSON.parse(fs.readFileSync("./responses.json","utf8"));
    } catch {
        return {
            morning: "בוקר טוב! כאן ג'וניור ❤️ אלירן מסר שהוא מרגיש טוב ואוהב אותך.",
            visit: "כאן ג'וניור ❤️ אלירן ביקש למסור שיבואו בקרוב ויעדכן אותך.",
            pizza: "ג'וניור כאן ❤️ אלירן ביקש למסור שהוא אכל פיצה והיה טעים!",
            ate: "כן! ג'וניור כאן. אלירן אכל והכל בסדר ❤️"
        }
    }
}

async function start() {
    const { state, saveCreds } = await useMultiFileAuthState('auth');
    const sock = makeWASocket({
        auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })) },
        logger: pino({ level: 'silent' }),
        browser: ["Eliran Bot", "Chrome", "1.0"]
    });

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
        if (qr) { console.log("QR CODE:"); qrcode.generate(qr, { small: true }); }
        if (connection === 'close' && lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) start();
        if (connection === 'open') console.log("!!! הבוט מחובר ועובד 24/7 !!!");
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg?.message) return;
        if (msg.key.remoteJid && !msg.key.remoteJid.endsWith('@g.us')) return;
        try {
            const group = await sock.groupMetadata(msg.key.remoteJid);
            if (group.subject !== GROUP_NAME) return;
            const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase();
            const r = loadResponses();
            let reply = null;
            if (text.includes('מתי')) reply = r.visit;
            else if (text.includes('מה אכלת')) reply = r.pizza;
            else if (text.includes('אכלת')) reply = r.ate;
            else if (text.includes('בוקר טוב') || text.includes('מה שלומך')) reply = r.morning;
            if (reply) await sock.sendMessage(msg.key.remoteJid, { text: reply }, { quoted: msg });
        } catch(e) { console.log(e.message); }
    });
}
start();