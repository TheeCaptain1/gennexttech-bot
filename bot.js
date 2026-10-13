const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req,res) => res.send('GenNextTech Bot ONLINE - Full Menu + Admin + Unlimited Hosting'));
app.listen(PORT, () => console.log(`Port ${PORT} Open - Render OK`));
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, downloadMediaMessage } = require('@whiskeysockets/baileys')
const P = require('pino')
const fs = require('fs')
const axios = require('axios')
const config = require('./config')

if (process.env.SESSION_ID) {
  try {
    if (!fs.existsSync('./session_main')) fs.mkdirSync('./session_main', { recursive: true });
    let sessionData = process.env.SESSION_ID;
    if (sessionData.startsWith('GenNextTech_')) sessionData = sessionData.replace('GenNextTech_', '');
    const creds = Buffer.from(sessionData, 'base64').toString();
    fs.writeFileSync('./session_main/creds.json', creds);
    console.log('✅ SESSION_ID restored');
  } catch (e) { console.log('❌ SESSION_ID restore failed:', e.message); }
}
if(!fs.existsSync('./sessions')) fs.mkdirSync('./sessions', {recursive:true})

async function apiCall(action, data = {}) {
  try { const res = await axios.post(config.apiUrl, { secret: config.apiSecret, action,...data }); return res.data; }
  catch (e) { return { success: false, message: e.message } }
}

let SETTINGS = { autostatus: true, autostatusReact: true, autoread: false, autotyping: false, autoreact: true, anticall: false, mode: 'public', welcome:true, goodbye:true, antilink:false };

const CUSTOMER_MENU = `╔═════════════════
║ GenNextTech Bot
║ By Thee Captain
╚═══════════════════╝
*General*:.menu.ping.alive.tts.owner.joke.quote.fact.weather.news.attp.lyrics.8ball.groupinfo.staff.vv.trt.ss.jid.url
*Admin*:.ban.promote.demote.mute.unmute.del.kick.warn.warnings.antilink.clear.tag.tagall.hidetag.welcome.goodbye.setgdesc.setgname.setgpp
*Owner*:.mode.autostatus on/off.autostatus react on/off.autoread.autotyping.autoreact.setpp
*Sticker*:.sticker.simage.blur.removebg.remini.crop.meme.take.emojimix.igs
*Pies*:.pies.china.japan.korea.hijab
*Game*:.tictactoe.truth.dare.hangman.trivia
*AI*:.gpt.gemini.imagine.flux
*Fun*:.compliment.insult.flirt.ship.wasted.character.ship
*Textmaker*:.metallic.ice.snow.matrix.neon.devil.leaves.1917.arena.hacker.sand.blackpink.glitch.fire
*Downloader*:.play.song.video.ytmp4.tiktok.instagram.facebook.spotify
*Anime*:.nom.poke.cry.kiss.pat.hug.wink
*Github*:.git.sc.repo
*Buy Bot*:.packages.order CODE Name.status
GenNextTech By Thee Captain`;

const customerBots = {}
async function deployCustomerBot(customerJid, botName) {
  const customerNumber = customerJid.replace('@s.whatsapp.net','').replace('@lid','').replace('+','').replace(/[^0-9]/g,'')
  const sessionPath = `./sessions/${customerNumber}`
  if(!fs.existsSync(sessionPath)) fs.mkdirSync(sessionPath, { recursive: true })
  if(customerBots[customerNumber]) return customerBots[customerNumber]
  const { state, saveCreds } = await useMultiFileAuthState(sessionPath)
  const sock = makeWASocket({ auth: state, logger: P({ level: 'silent' }), browser: [botName,'Chrome','1.0.0'] })
  customerBots[customerNumber]=sock
  sock.ev.on('creds.update', saveCreds)
  sock.ev.on('connection.update', async (u)=>{
    const { connection, lastDisconnect } = u
    if(!sock.authState.creds.registered){
      try{
        await new Promise(r=>setTimeout(r,4000))
        if(!sock.authState.creds.registered){
          const code = await sock.requestPairingCode(customerNumber)
          const formatted = code?.match(/.{1,4}/g)?.join("-") || code
          console.log(`PAIRING CODE FOR ${customerNumber}: ${formatted}`)
          if(global.mainSock){
            await global.mainSock.sendMessage(global.mainSock.user.id, { text: `*Pairing Code for ${customerNumber}:* ${formatted}` })
            try{ await global.mainSock.sendMessage(customerJid, { text: `*🤖 GenNextTech Deployed!*\nBot: ${botName}\n\n*PAIRING CODE: ${formatted}*\nWhatsApp > Linked Devices > Link with phone number` }) }catch{}
          }
        }
      }catch(e){ console.log('Pairing error', e.message) }
    }
    if(connection==='open'){
      console.log(`✅ Customer Bot ${customerNumber} LIVE!`)
      if(global.mainSock) await global.mainSock.sendMessage(global.mainSock.user.id, { text: `✅ *Bot ${customerNumber} LIVE!*` })
    }
    if(connection==='close'){
      const reason = lastDisconnect?.error?.output?.statusCode
      if(reason!== DisconnectReason.loggedOut){ delete customerBots[customerNumber]; setTimeout(()=>deployCustomerBot(customerJid, botName), 3000) }
      else delete customerBots[customerNumber]
    }
  })

  sock.ev.on('messages.upsert', async ({messages})=>{
    const m=messages[0]; if(!m.message) return
    if(m.key.remoteJid === 'status@broadcast'){
      if(SETTINGS.autostatus){ await sock.readMessages([m.key]); if(SETTINGS.autostatusReact){ try{ await sock.sendMessage('status@broadcast', { react: { text: '❤️', key: m.key } }, { statusJidList: [m.key.participant] }) }catch{} } }
      return;
    }
    const from=m.key.remoteJid
    const body=m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || m.message.videoMessage?.caption || ""
    if(!body.startsWith('.')) return
    const args=body.slice(1).trim().split(/ +/); const cmd=args.shift().toLowerCase(); const text=args.join(" ")
    const q = m.message.extendedTextMessage?.contextInfo?.quotedMessage

    try{
    // === ADMIN COMMANDS ===
    const isGroup = from.endsWith('@g.us')
    let groupAdmins = []; let isBotAdmin = false; let isSenderAdmin = false;
    if(isGroup){
      try{
        const metadata = await sock.groupMetadata(from)
        groupAdmins = metadata.participants.filter(p=>p.admin!==null).map(p=>p.id)
        isBotAdmin = groupAdmins.includes(sock.user.id.split(':')[0]+'@s.whatsapp.net') || groupAdmins.includes(sock.user.id) || groupAdmins.some(a=> sock.user.id.includes(a.split('@')[0]))
        const senderId = m.key.participant || from
        isSenderAdmin = groupAdmins.includes(senderId)
      }catch{}
    }
    if(['ban','kick'].includes(cmd)){
      if(!isGroup) return sock.sendMessage(from,{text:"❌ Group only!"})
      if(!isSenderAdmin) return sock.sendMessage(from,{text:"❌ Admin only!"})
      if(!isBotAdmin) return sock.sendMessage(from,{text:"❌ Bot not admin!"})
      const target = m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || (q? m.message.extendedTextMessage?.contextInfo?.participant : null)
      if(!target) return sock.sendMessage(from,{text:"❌ Tag someone:.ban @user"})
      await sock.groupParticipantsUpdate(from, [target], "remove")
      return sock.sendMessage(from,{text:`✅ @${target.split('@')[0]} kicked`, mentions:[target]})
    }
    if(cmd==='promote'){
      if(!isGroup ||!isSenderAdmin ||!isBotAdmin) return sock.sendMessage(from,{text:"❌ Admin & bot admin required"})
      const target = m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0]; if(!target) return
      await sock.groupParticipantsUpdate(from, [target], "promote")
      return sock.sendMessage(from,{text:`✅ Promoted @${target.split('@')[0]}`, mentions:[target]})
    }
    if(cmd==='demote'){
      if(!isGroup ||!isSenderAdmin ||!isBotAdmin) return
      const target = m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0]; if(!target) return
      await sock.groupParticipantsUpdate(from, [target], "demote")
      return sock.sendMessage(from,{text:`✅ Demoted @${target.split('@')[0]}`, mentions:[target]})
    }
    if(cmd==='mute'){
      if(!isGroup ||!isSenderAdmin ||!isBotAdmin) return
      await sock.groupSettingUpdate(from, 'announcement')
      return sock.sendMessage(from,{text:"🔒 Group muted!"})
    }
    if(cmd==='unmute'){
      if(!isGroup ||!isSenderAdmin ||!isBotAdmin) return
      await sock.groupSettingUpdate(from, 'not_announcement')
      return sock.sendMessage(from,{text:"🔓 Group unmuted!"})
    }
    if(cmd==='del' || cmd==='delete'){
      if(!isGroup ||!isSenderAdmin) return sock.sendMessage(from,{text:"❌ Admin only"})
      if(!q) return sock.sendMessage(from,{text:"❌ Reply to message"})
      const key = { remoteJid: from, fromMe: false, id: m.message.extendedTextMessage.contextInfo.stanzaId, participant: m.message.extendedTextMessage.contextInfo.participant }
      return await sock.sendMessage(from,{delete:key})
    }
    if(cmd==='setgdesc'){
      if(!isGroup ||!isSenderAdmin ||!isBotAdmin) return
      if(!text) return sock.sendMessage(from,{text:"Use.setgdesc New description"})
      await sock.groupUpdateDescription(from, text)
      return sock.sendMessage(from,{text:"✅ Description updated"})
    }
    if(cmd==='setgname'){
      if(!isGroup ||!isSenderAdmin ||!isBotAdmin) return
      if(!text) return
      await sock.groupUpdateSubject(from, text)
      return sock.sendMessage(from,{text:`✅ Name changed to ${text}`})
    }
    if(cmd==='setgpp'){
      if(!isGroup ||!isSenderAdmin ||!isBotAdmin) return
      if(!m.message.imageMessage &&!q?.imageMessage) return sock.sendMessage(from,{text:"Reply image with.setgpp"})
      const buf = await downloadMediaMessage(m, 'buffer', {})
      await sock.updateProfilePicture(from, buf)
      return sock.sendMessage(from,{text:"✅ Group DP updated"})
    }
    if(cmd==='welcome'){
      if(!isGroup ||!isSenderAdmin) return
      if(text.toLowerCase()==='on'){ SETTINGS.welcome=true; return sock.sendMessage(from,{text:"✅ Welcome ON"}) }
      if(text.toLowerCase()==='off'){ SETTINGS.welcome=false; return sock.sendMessage(from,{text:"❌ Welcome OFF"}) }
      return sock.sendMessage(from,{text:`Welcome ${SETTINGS.welcome?'ON':'OFF'}`})
    }
    if(cmd==='goodbye'){
      if(!isGroup ||!isSenderAdmin) return
      if(text.toLowerCase()==='on'){ SETTINGS.goodbye=true; return sock.sendMessage(from,{text:"✅ Goodbye ON"}) }
      if(text.toLowerCase()==='off'){ SETTINGS.goodbye=false; return sock.sendMessage(from,{text:"❌ Goodbye OFF"}) }
      return sock.sendMessage(from,{text:`Goodbye ${SETTINGS.goodbye?'ON':'OFF'}`})
    }
    if(cmd==='antilink'){
      if(!isGroup ||!isSenderAdmin) return
      if(text.toLowerCase()==='on'){ SETTINGS.antilink=true; return sock.sendMessage(from,{text:"✅ Antilink ON"}) }
      if(text.toLowerCase()==='off'){ SETTINGS.antilink=false; return sock.sendMessage(from,{text:"❌ Antilink OFF"}) }
      return sock.sendMessage(from,{text:`Antilink ${SETTINGS.antilink?'ON':'OFF'}`})
    }
    if(cmd==='warn'){
      if(!isGroup ||!isSenderAdmin) return
      const target = m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0]; if(!target) return
      return sock.sendMessage(from,{text:`⚠️ @${target.split('@')[0]} warned!`, mentions:[target]})
    }
    if(cmd==='warnings') return sock.sendMessage(from,{text:"⚠️ Warnings: 0"})

    // === GENERAL ===
    if(['menu','help'].includes(cmd)) return await sock.sendMessage(from,{text:CUSTOMER_MENU})
    if(cmd==='ping') return await sock.sendMessage(from,{text:`*Pong!* ${Date.now()-m.messageTimestamp*1000}ms`})
    if(cmd==='alive') return await sock.sendMessage(from,{text:`*GenNextTech Alive*\nBot: ${botName}\nMode:${SETTINGS.mode}\nAutostatus:${SETTINGS.autostatus?'ON':'OFF'}`})
    if(cmd==='owner') return await sock.sendMessage(from,{text:`*👑 Thee Captain*\nwa.me/${config.ownerNumber}`})
    if(cmd==='joke'){ const {data}=await axios.get('https://official-joke-api.appspot.com/random_joke'); return await sock.sendMessage(from,{text:`${data.setup}\n\n${data.punchline}`}) }
    if(cmd==='quote'){ const {data}=await axios.get('https://api.quotable.io/random'); return await sock.sendMessage(from,{text:`"${data.content}"\n- ${data.author}`}) }
    if(cmd==='fact'){ const {data}=await axios.get('https://uselessfacts.jsph.pl/random.json?language=en'); return await sock.sendMessage(from,{text:data.text}) }
    if(cmd==='8ball'){ const ans=['Yes','No','Maybe','Definitely','Ask again','Absolutely','Never']; return await sock.sendMessage(from,{text:`🎱 Q: ${text}\nA: ${ans[Math.floor(Math.random()*ans.length)]}`}) }
    if(cmd==='weather'){ const {data}=await axios.get(`https://wttr.in/${text}?format=3`); return await sock.sendMessage(from,{text:data}) }
    if(cmd==='jid') return await sock.sendMessage(from,{text:`*JID:* ${from}\n*Your JID:* ${m.key.participant||from}`})
    if(cmd==='gpt'||cmd==='gemini'){ if(!text) return sock.sendMessage(from,{text:`Use.${cmd} question`}); const {data}=await axios.get(`https://api.voids.top/gpt?text=${encodeURIComponent(text)}`); return await sock.sendMessage(from,{text:data.result||`*AI:* ${text}`}) }
    if(['imagine','flux','sora'].includes(cmd)){ if(!text) return; const url=`https://image.pollinations.ai/prompt/${encodeURIComponent(text)}`; return await sock.sendMessage(from,{image:{url}, caption:`*${cmd}:* ${text}`}) }
    if(['play','song'].includes(cmd)){ if(!text) return; await sock.sendMessage(from,{text:`🔍 Searching ${text}...`}); try{ const res=await axios.get(`https://api.voids.top/youtube?search=${encodeURIComponent(text)}`); const video=res.data?.result?.[0]||res.data?.[0]; if(video?.audio||video?.url) return await sock.sendMessage(from,{audio:{url:video.audio||video.url}, mimetype:'audio/mpeg', caption:`*${video.title}*`}) }catch{} }
    if(cmd==='tiktok'){ if(!text) return; try{ const {data}=await axios.get(`https://api.voids.top/tiktok?url=${encodeURIComponent(text)}`); return await sock.sendMessage(from,{video:{url:data.result?.video||data.url}, caption:"*TikTok*"}) }catch{} }
    if(cmd==='sticker'||cmd==='s'){ if(m.message.imageMessage||q?.imageMessage){ const buf=await downloadMediaMessage(m, 'buffer', {}); return await sock.sendMessage(from,{sticker:buf}) } return sock.sendMessage(from,{text:"Reply image with.sticker"}) }
    const animeCmds=['nom','poke','cry','kiss','pat','hug','wink']; if(animeCmds.includes(cmd)){ const {data}=await axios.get(`https://api.waifu.pics/sfw/${cmd}`); return await sock.sendMessage(from,{image:{url:data.url}, caption:`*${cmd}*`}) }
    if(['tagall','tag'].includes(cmd)){ const g=await sock.groupMetadata(from); let txt=`*${text||'TagAll'}*\n`; let mentions=[]; for(let p of g.participants){txt+=`@${p.id.split('@')[0]} `; mentions.push(p.id)} return await sock.sendMessage(from,{text:txt, mentions}) }
    if(cmd==='hidetag'){ const g=await sock.groupMetadata(from); let mentions=g.participants.map(p=>p.id); return await sock.sendMessage(from,{text:text||'hidetag', mentions}) }
    if(['git','sc','repo'].includes(cmd)){ return sock.sendMessage(from,{text:`*GenNextTech Bot*\nBy Thee Captain\nGithub: github.com/TheeCaptain/GenNextTech`}) }
    }catch(e){ console.log(e); await sock.sendMessage(from,{text:`❌ Error ${cmd}: ${e.message}`}) }
  })
  return sock
}

async function loadCustomerBots(){
  if(!fs.existsSync('./sessions')) return
  const bots = fs.readdirSync('./sessions')
  for(const botNumber of bots){
    if(botNumber.length>=10 && /^\d+$/.test(botNumber)){
      console.log(`Loading customer bot: ${botNumber}`)
      await deployCustomerBot(botNumber+'@s.whatsapp.net', 'GenNextTech Bot')
      await new Promise(r=>setTimeout(r,2000))
    }
  }
}

async function startMain(){
  const { state, saveCreds } = await useMultiFileAuthState('./session_main')
  const sock = makeWASocket({ auth: state, logger: P({ level: 'silent' }), printQRInTerminal: false, browser: ['GenNextTech Bot','Chrome','1.0'] })
  global.mainSock=sock
  sock.ev.on('creds.update', saveCreds)
  sock.ev.on('connection.update', async (u)=>{
    const { qr, connection, lastDisconnect } = u
    if(qr &&!state.creds.registered){
      console.log('--- SCAN QR ---'); try{ const qrcode = require('qrcode-terminal'); qrcode.generate(qr, {small:true}) }catch{}
      console.log('QR String:', qr)
      if(process.env.PHONE_NUMBER){ try{ await new Promise(r=>setTimeout(r,3000)); const code = await sock.requestPairingCode(process.env.PHONE_NUMBER.replace(/[^0-9]/g,'')); console.log(`MAIN PAIRING CODE: ${code?.match(/.{1,4}/g)?.join("-") || code}`) }catch{} }
    }
    if(connection==='open'){
      console.log('✅ MAIN BOT ONLINE')
      try{ const creds = fs.readFileSync('./session_main/creds.json'); const b64 = Buffer.from(creds).toString('base64'); console.log('SESSION_ID: GenNextTech_'+b64) }catch(e){}
      loadCustomerBots()
    }
    if(connection==='close'){ const code = lastDisconnect?.error?.output?.statusCode; if(code!== DisconnectReason.loggedOut) setTimeout(()=>startMain(),3000) }
  })
  sock.ev.on('messages.upsert', async ({messages})=>{
    const m=messages[0]; if(!m.message || m.key.fromMe) return
    if(m.key.remoteJid === 'status@broadcast'){
      if(SETTINGS.autostatus){ await sock.readMessages([m.key]); if(SETTINGS.autostatusReact){ try{ await sock.sendMessage('status@broadcast', { react: { text: '❤️', key: m.key } }, { statusJidList: [m.key.participant] }) }catch{} } }
      return;
    }
    const from=m.key.remoteJid; const body=m.message.conversation || m.message.extendedTextMessage?.text || ""; if(!body.startsWith(config.prefix)) return
    const args=body.slice(1).trim().split(/ +/); const cmd=args.shift().toLowerCase(); const text=args.join(" "); const isOwner = from.includes(config.ownerNumber)
    if(['deploy','pair'].includes(cmd)){
      if(!isOwner) return sock.sendMessage(from,{text:"❌ Owner only!"}, {quoted:m})
      const number = text.replace(/[^0-9]/g,''); if(!number || number.length < 10) return sock.sendMessage(from,{text:"❌ Use:.deploy 254704123456"}, {quoted:m})
      await sock.sendMessage(from,{text:`⏳ Deploying ${number}... Check logs for pairing code!`}, {quoted:m}); await deployCustomerBot(number+'@s.whatsapp.net', 'GenNextTech Bot'); return
    }
    if(cmd==='listbots' && isOwner){ const bots = fs.existsSync('./sessions')? fs.readdirSync('./sessions').filter(f=> /^\d+$/.test(f)) : []; return sock.sendMessage(from,{text:`*🤖 Active Bots: ${bots.length}*\n\n${bots.map(b=>`• ${b} - LIVE`).join('\n') || 'No bots'}`}, {quoted:m}) }
    if(cmd==='deletebot' && isOwner){ const number = text.replace(/[^0-9]/g,''); if(customerBots[number]){ try{ await customerBots[number].logout() }catch{} delete customerBots[number] } if(fs.existsSync(`./sessions/${number}`)) fs.rmSync(`./sessions/${number}`, {recursive:true, force:true}); return sock.sendMessage(from,{text:`✅ Bot ${number} deleted!`}, {quoted:m}) }
    if(cmd==='autostatus'){ if(!isOwner) return; const sub=args[0]?.toLowerCase(); const val=args[1]?.toLowerCase(); if(sub==='react'){ SETTINGS.autostatusReact = val==='on'; return sock.sendMessage(from,{text:`React ${SETTINGS.autostatusReact?'ON':'OFF'}`},{quoted:m}) } if(sub==='on'){ SETTINGS.autostatus=true; return sock.sendMessage(from,{text:"✅ Autostatus ON"},{quoted:m}) } if(sub==='off'){ SETTINGS.autostatus=false; return sock.sendMessage(from,{text:"❌ Autostatus OFF"},{quoted:m}) } return sock.sendMessage(from,{text:`Autostatus:${SETTINGS.autostatus?'ON':'OFF'}\nReact:${SETTINGS.autostatusReact?'ON':'OFF'}`},{quoted:m}) }
    if(['menu','help'].includes(cmd)) return sock.sendMessage(from,{text:`*GenNextTech Main*\n.deploy 254....listbots.deletebot\n.packages.order.status.approve.autostatus on/off\n\n${CUSTOMER_MENU}`},{quoted:m})
    if(cmd==='packages') return sock.sendMessage(from,{text:`*🤖 GenNextTech*\n200 KES/2 Months\nMpesa:${config.mpesaNumber}\n.order MPESACODE BotName`},{quoted:m})
    if(cmd==='status'){ const res=await apiCall('check_status',{phone:from.split('@')[0]}); return sock.sendMessage(from,{text:res.active?`✅ Active till ${res.expires}`:`❌ Not active`},{quoted:m}) }
    if(['order','buy'].includes(cmd)){ const parts=text.split(' '); const mpesa=parts[0]?.toUpperCase(); const botname=parts.slice(1).join(' ')||'GenNextTech Bot'; if(!mpesa) return sock.sendMessage(from,{text:"Use:.order MPESACODE BotName"},{quoted:m}); const verify=await apiCall('verify_payment',{phone:from.split('@')[0], mpesa_code:mpesa, bot_name:botname}); if(verify.success){ await sock.sendMessage(from,{text:`🎉 Verified! Deploying ${botname}`},{quoted:m}); await deployCustomerBot(from, botname); } else{ await apiCall('create_order',{phone:from.split('@')[0], amount:200, bot_name:botname}); await sock.sendMessage(from,{text:`⏳ ${verify.message} - Owner notified`},{quoted:m}); await sock.sendMessage(config.ownerNumber+"@s.whatsapp.net",{text:`🔔 NEW PAYMENT\nFrom:${from}\nCode:${mpesa}\nBot:${botname}\n.approve ${mpesa} ${from.split('@')[0]}`}) } }
    if(cmd==='approve' && isOwner){ const parts=text.split(' '); const code=parts[0]?.toUpperCase(); const custPhone=parts[1]; const res=await apiCall('verify_payment',{phone:custPhone||config.ownerNumber, mpesa_code:code}); await sock.sendMessage(from,{text:res.success?`✅ Approved ${code}`:`❌ ${res.message}`},{quoted:m}); if(res.success&&custPhone) await deployCustomerBot(custPhone+'@s.whatsapp.net','GenNextTech Bot') }
  })
}
startMain()