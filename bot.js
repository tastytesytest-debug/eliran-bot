import makeWASocket, { useMultiFileAuthState, DisconnectReason, makeCacheableSignalKeyStore } from "@whiskeysockets/baileys";
import pino from "pino";
import fs from "fs";
import http from "http";
import QRCode from "qrcode";

const GROUP_NAME = "שיחה עם אלירן";
const PORT = process.env.PORT || 10000;
let lastQR = "";

http.createServer(async (req,res)=>{
  if(req.url==="/qr" && lastQR){
    const img = await QRCode.toDataURL(lastQR);
    res.writeHead(200, {"Content-Type":"text/html"});
    return res.end(`<h1>סרוק את ה-QR בוואטסאפ</h1><img src="${img}" style="width:400px"><script>setTimeout(()=>location.reload(),5000)</script>`);
  }
  res.writeHead(200); res.end(`<a href="/qr">לחץ כאן ל-QR</a> - Bot Running`);
}).listen(PORT, ()=>console.log("Server on "+PORT));

function loadResponses(){
  try{return JSON.parse(fs.readFileSync("./responses.json","utf8"))}
  catch{return {morning:"בוקר טוב! כאן ג'וניור ❤️", visit:"כאן ג'וניור ❤️ יבואו בקרוב", pizza:"אכל פיצה והיה טעים! ❤️", ate:"כן! אכל והכל בסדר ❤️"}}
}
async function start(){
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  const sock = makeWASocket({auth:{creds:state.creds, keys:makeCacheableSignalKeyStore(state.keys, pino({level:'silent'}))}, logger:pino({level:'silent'}), browser:["Eliran Bot","Chrome","1.0"]});
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if(qr){ lastQR=qr; console.log("QR חדש! כנס ל- /qr באתר"); }
    if(connection==='close' && lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) start();
    if(connection==='open'){ console.log("!!! הבוט מחובר ועובד 24/7 !!!"); lastQR=""; }
  });
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg=messages[0]; if(!msg?.message) return;
    if(msg.key.remoteJid && !msg.key.remoteJid.endsWith('@g.us')) return;
    try{
      const group=await sock.groupMetadata(msg.key.remoteJid);
      if(group.subject!==GROUP_NAME) return;
      const text=(msg.message.conversation||msg.message.extendedTextMessage?.text||"").toLowerCase();
      const r=loadResponses(); let reply=null;
      if(text.includes('מתי')) reply=r.visit;
      else if(text.includes('מה אכלת')) reply=r.pizza;
      else if(text.includes('אכלת')) reply=r.ate;
      else if(text.includes('בוקר טוב')||text.includes('מה שלומך')) reply=r.morning;
      if(reply) await sock.sendMessage(msg.key.remoteJid, {text:reply}, {quoted:msg});
    }catch(e){console.log(e.message)}
  });
}
start();
