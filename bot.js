const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, downloadMediaMessage } = require('@whiskeysockets/baileys')
const P = require('pino')
const fs = require('fs')
const axios = require('axios')
const config = require('./config')

async function apiCall(action, data = {}) {
  try {
    const res = await axios.post(config.apiUrl, { secret: config.apiSecret, action,...data });
    return res.data;
  } catch (e) { return { success: false, message: e.message } }
}

let SETTINGS = { autostatus: true, autostatusReact: true, autoread: false, autotyping: false, autoreact: true, anticall: false, mode: 'public' };

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
  const customerNumber = customerJid.replace('@s.whatsapp.net','').replace('+','')
  const sessionPath = `./sessions/${customerNumber}`
  if(!fs.existsSync(sessionPath)) fs.mkdirSync(sessionPath, { recursive: true })
  if(customerBots[customerNumber]) return
  const { state, saveCreds } = await useMultiFileAuthState(sessionPath)
  const sock = makeWASocket({ auth: state, logger: P({ level: 'silent' }), browser: [botName,'Chrome','1.0.0'] })
  customerBots[customerNumber]=sock
  sock.ev.on('creds.update', saveCreds)
  if(!state.creds.registered){
    setTimeout(async()=>{
      try{
        const code = await sock.requestPairingCode(customerNumber)
        if(global.mainSock) await global.mainSock.sendMessage(customerJid, { text: `*🤖 GenNextTech Deployed!*\nBot: ${botName}\n✅ VERIFIED\n\n*PAIRING CODE: ${code}*\nWhatsApp > Linked Devices > Link with phone number > Enter code` })
      }catch{}
    },4000)
  }

  sock.ev.on('messages.upsert', async ({messages})=>{
    const m=messages[0]; if(!m.message) return
    if(m.key.remoteJid === 'status@broadcast'){
      if(SETTINGS.autostatus){
        await sock.readMessages([m.key]);
        if(SETTINGS.autostatusReact){ try{ await sock.sendMessage('status@broadcast', { react: { text: '❤️', key: m.key } }, { statusJidList: [m.key.participant] }) }catch{} }
      }
      return;
    }
    const from=m.key.remoteJid
    const body=m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || m.message.videoMessage?.caption || ""
    if(!body.startsWith('.')) return
    const args=body.slice(1).trim().split(/ +/); const cmd=args.shift().toLowerCase(); const text=args.join(" ")
    const q = m.message.extendedTextMessage?.contextInfo?.quotedMessage

    try{
    // === GENERAL ===
    if(['menu','help'].includes(cmd)) return await sock.sendMessage(from,{text:CUSTOMER_MENU})
    if(cmd==='ping') return await sock.sendMessage(from,{text:`*Pong!* ${Date.now()-m.messageTimestamp*1000}ms\nGenNextTech`})
    if(cmd==='alive') return await sock.sendMessage(from,{text:`*GenNextTech Alive*\nBot: ${botName}\nBy Thee Captain\nMode:${SETTINGS.mode}\nAutostatus:${SETTINGS.autostatus?'ON':'OFF'}`})
    if(cmd==='owner') return await sock.sendMessage(from,{text:`*👑 Thee Captain*\nwa.me/${config.ownerNumber}\nGenNextTech`})
    if(cmd==='joke'){ const {data}=await axios.get('https://official-joke-api.appspot.com/random_joke'); return await sock.sendMessage(from,{text:`${data.setup}\n\n${data.punchline}`}) }
    if(cmd==='quote'){ const {data}=await axios.get('https://api.quotable.io/random'); return await sock.sendMessage(from,{text:`"${data.content}"\n- ${data.author}`}) }
    if(cmd==='fact'){ const {data}=await axios.get('https://uselessfacts.jsph.pl/random.json?language=en'); return await sock.sendMessage(from,{text:data.text}) }
    if(cmd==='8ball'){ const ans=['Yes','No','Maybe','Definitely','Ask again','Absolutely','Never']; return await sock.sendMessage(from,{text:`🎱 *8Ball*\nQ: ${text}\nA: ${ans[Math.floor(Math.random()*ans.length)]}`}) }
    if(cmd==='weather'){ const {data}=await axios.get(`https://wttr.in/${text}?format=3`); return await sock.sendMessage(from,{text:data}) }
    if(cmd==='jid') return await sock.sendMessage(from,{text:`*JID:* ${from}\n*Your JID:* ${m.key.participant||from}`})
    if(cmd==='url'){ if(q?.imageMessage||m.message.imageMessage){ const buf=await downloadMediaMessage(m, 'buffer', {}); const {data}=await axios.post('https://catbox.moe/user/api.php', {reqtype:'fileupload', fileToUpload: buf}, {headers:{'Content-Type':'multipart/form-data'}}); return await sock.sendMessage(from,{text:`URL: ${data}`}) } }

    // === AI ===
    if(cmd==='gpt'||cmd==='gemini'){ if(!text) return sock.sendMessage(from,{text:`Use.${cmd} question`}); const {data}=await axios.get(`https://api.voids.top/gpt?text=${encodeURIComponent(text)}`); return await sock.sendMessage(from,{text:data.result||`*AI:* ${text} - GenNextTech`}) }
    if(['imagine','flux','sora'].includes(cmd)){ if(!text) return; const url=`https://image.pollinations.ai/prompt/${encodeURIComponent(text)}`; return await sock.sendMessage(from,{image:{url}, caption:`*${cmd}:* ${text}\nGenNextTech`}) }

    // === TEXTMAKER ===
    const textmakers = { metallic:'metallic', ice:'ice', snow:'snow', impressive:'impressive', matrix:'matrix', light:'light', neon:'neon', devil:'devil', purple:'purple', thunder:'thunder', leaves:'leaves', '1917':'1917', arena:'arena', hacker:'hacker', sand:'sand', blackpink:'blackpink', glitch:'glitch', fire:'fire' }
    if(textmakers[cmd]){ if(!text) return sock.sendMessage(from,{text:`Use.${cmd} text`}); const url=`https://api.ephoto360.com/create_effect?text=${encodeURIComponent(text)}&effect=${cmd}`; // fallback to pollinations
      const img=`https://textpro.me/create-${cmd}-text-effect-online-1081.html`;
      return await sock.sendMessage(from,{image:{url:`https://api.popcat.xyz/textmaker?text=${encodeURIComponent(text)}&effect=${cmd}`}, caption:`*${cmd}*: ${text}\nBy Thee Captain`})
    }

    // === DOWNLOADER ===
    if(['play','song'].includes(cmd)){ if(!text) return; await sock.sendMessage(from,{text:`🔍 Searching ${text}...`}); const res=await axios.get(`https://api.voids.top/youtube?search=${encodeURIComponent(text)}`); const video=res.data?.result?.[0]||res.data?.[0]; if(!video) return sock.sendMessage(from,{text:"Not found, use.video link"}); return await sock.sendMessage(from,{audio:{url:video.audio||video.url}, mimetype:'audio/mpeg', caption:`*${video.title}*\nGenNextTech`}) }
    if(['video','ytmp4'].includes(cmd)){ if(!text) return; return await sock.sendMessage(from,{text:`📥 *YT Video*\n${text}\nUse ytmp4 API: https://api.voids.top/ytmp4?url=${encodeURIComponent(text)}`}) }
    if(cmd==='tiktok'){ if(!text) return; const {data}=await axios.get(`https://api.voids.top/tiktok?url=${encodeURIComponent(text)}`); return await sock.sendMessage(from,{video:{url:data.result?.video||data.url}, caption:"*TikTok* - GenNextTech"}) }
    if(cmd==='instagram'||cmd==='igs'||cmd==='igsc'){ if(!text) return; const {data}=await axios.get(`https://api.voids.top/instagram?url=${encodeURIComponent(text)}`); return await sock.sendMessage(from,{video:{url:data.result?.url||data.url}, caption:"*Insta* - GenNextTech"}) }
    if(cmd==='facebook'){ if(!text) return; const {data}=await axios.get(`https://api.voids.top/facebook?url=${encodeURIComponent(text)}`); return await sock.sendMessage(from,{video:{url:data.result||data.url}, caption:"*FB* - GenNextTech"}) }

    // === STICKER ===
    if(cmd==='sticker'||cmd==='s'){ if(m.message.imageMessage||q?.imageMessage){ const buf=await downloadMediaMessage(m, 'buffer', {}); return await sock.sendMessage(from,{sticker:buf}) } return sock.sendMessage(from,{text:"Reply to image with.sticker"}) }
    if(cmd==='simage'){ if(q?.stickerMessage){ const buf=await downloadMediaMessage({message:q}, 'buffer', {}); return await sock.sendMessage(from,{image:buf}) } }
    if(cmd==='meme'){ const {data}=await axios.get('https://meme-api.com/gimme'); return await sock.sendMessage(from,{image:{url:data.url}, caption:data.title}) }
    if(cmd==='emojimix'){ const [a,b]=text.split('+'); const url=`https://api.popcat.xyz/emojimix?emoji1=${a}&emoji2=${b}`; return await sock.sendMessage(from,{image:{url}}) }
    if(cmd==='take'){ return await sock.sendMessage(from,{text:`Pack set to ${text||'GenNextTech'}`}) }

    // === ANIME ===
    const animeCmds=['nom','poke','cry','kiss','pat','hug','wink','facepalm']; if(animeCmds.includes(cmd)){ const {data}=await axios.get(`https://api.waifu.pics/sfw/${cmd}`); return await sock.sendMessage(from,{image:{url:data.url}, caption:`*${cmd}*`}) }

    // === FUN / MISC EFFECTS ===
    const funEffects=['wasted','circle','lgbt','jail','passed','triggered','horny','lolice','its-so-stupid','namecard','oogway','tweet','ytcomment','comrade','gay','glass','heart','horny'];
    if(funEffects.includes(cmd)||['compliment','insult','flirt','shayari','ship','character','simp','stupid'].includes(cmd)){
      const target = m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0]||from;
      if(['compliment','insult','flirt'].includes(cmd)){ const {data}=await axios.get(`https://api.popcat.xyz/${cmd}`); return sock.sendMessage(from,{text:data.compliment||data.insult||data.flirt||`${cmd} for @${target.split('@')[0]}`, mentions:[target]}) }
      return await sock.sendMessage(from,{image:{url:`https://api.popcat.xyz/${cmd}?image=${await sock.profilePictureUrl(target,'image').catch(()=> 'https://i.imgur.com/2wzGhpF.jpeg')}`}, caption:`*${cmd}*`})
    }

    // === PIES ===
    if(['pies','china','indonesia','japan','korea','hijab'].includes(cmd)){ const {data}=await axios.get(`https://api.waifu.pics/sfw/waifu`); return await sock.sendMessage(from,{image:{url:data.url}, caption:`*${cmd}*`}) }

    // === GROUP ADMIN ===
    if(['tagall','tag'].includes(cmd)){ const g=await sock.groupMetadata(from); let txt=`*${text||'TagAll'}*\n`; let mentions=[]; for(let p of g.participants){txt+=`@${p.id.split('@')[0]} `; mentions.push(p.id)} return await sock.sendMessage(from,{text:txt, mentions}) }
    if(cmd==='hidetag'){ const g=await sock.groupMetadata(from); let mentions=g.participants.map(p=>p.id); return await sock.sendMessage(from,{text:text||'hidetag', mentions}) }
    if(cmd==='groupinfo'){ const g=await sock.groupMetadata(from); return sock.sendMessage(from,{text:`*${g.subject}*\nMembers:${g.participants.length}\nDesc:${g.desc}`}) }

    // === GITHUB ===
    if(['git','github','sc','repo','script'].includes(cmd)){ return sock.sendMessage(from,{text:`*GenNextTech Bot*\nBy Thee Captain\nGithub: github.com/TheeCaptain/GenNextTech\nPrice: 200 KES/2 Months\nwa.me/${config.ownerNumber}`}) }

    await sock.sendMessage(from,{text:`*${cmd}* active ✅\n.menu for list`})

    }catch(e){ console.log(e); await sock.sendMessage(from,{text:`❌ Error ${cmd}: ${e.message}`}) }
  })
}

async function startMain(){
  const { state, saveCreds } = await useMultiFileAuthState('./session_main')
  const sock = makeWASocket({ auth: state, logger: P({ level: 'silent' }), browser: ['GenNextTech Main','Chrome','1.0.0'], printQRInTerminal: true })
  global.mainSock=sock
  sock.ev.on('creds.update', saveCreds)
  sock.ev.on('connection.update', (u)=>{ if(u.connection==='close' && u.lastDisconnect?.error?.output?.statusCode!== DisconnectReason.loggedOut) startMain(); if(u.connection==='open') console.log("✅ MAIN ONLINE - Autostatus:", SETTINGS.autostatus) })
  sock.ev.on('messages.upsert', async ({messages})=>{
    const m=messages[0]; if(!m.message || m.key.fromMe) return
    if(m.key.remoteJid === 'status@broadcast'){
      if(SETTINGS.autostatus){ await sock.readMessages([m.key]); if(SETTINGS.autostatusReact){ try{ await sock.sendMessage('status@broadcast', { react: { text: '❤️', key: m.key } }, { statusJidList: [m.key.participant] }) }catch{} } }
      return;
    }
    const from=m.key.remoteJid
    const body=m.message.conversation || m.message.extendedTextMessage?.text || ""
    if(!body.startsWith(config.prefix)) return
    const args=body.slice(1).trim().split(/ +/); const cmd=args.shift().toLowerCase(); const text=args.join(" ")
    const isOwner = from.includes(config.ownerNumber)

    if(cmd==='autostatus'){
      if(!isOwner) return
      const sub=args[0]?.toLowerCase(); const val=args[1]?.toLowerCase();
      if(sub==='react'){ SETTINGS.autostatusReact = val==='on'; return sock.sendMessage(from,{text:`React ${SETTINGS.autostatusReact?'ON':'OFF'}`},{quoted:m}) }
      if(sub==='on'){ SETTINGS.autostatus=true; return sock.sendMessage(from,{text:"✅ Autostatus ON - Viewing all status"},{quoted:m}) }
      if(sub==='off'){ SETTINGS.autostatus=false; return sock.sendMessage(from,{text:"❌ Autostatus OFF"},{quoted:m}) }
      return sock.sendMessage(from,{text:`Autostatus:${SETTINGS.autostatus?'ON':'OFF'}\nReact:${SETTINGS.autostatusReact?'ON':'OFF'}\nUse.autostatus on/off`},{quoted:m})
    }
    if(['menu','help'].includes(cmd)) return sock.sendMessage(from,{text:`*GenNextTech Main*\n.packages\n.order CODE Name\n.status\n.autostatus on/off\n.approve CODE PHONE`},{quoted:m})
    if(cmd==='packages') return sock.sendMessage(from,{text:`*🤖 GenNextTech*\n200 KES/2 Months\nMpesa:${config.mpesaNumber}\n.order CODE BotName`},{quoted:m})
    if(cmd==='status'){ const res=await apiCall('check_status',{phone:from.split('@')[0]}); return sock.sendMessage(from,{text:res.active?`✅ Active till ${res.expires}`:`❌ Not active`},{quoted:m}) }
    if(['order','buy'].includes(cmd)){
      const parts=text.split(' '); const mpesa=parts[0]?.toUpperCase(); const botname=parts.slice(1).join(' ')||'GenNextTech Bot'
      if(!mpesa) return sock.sendMessage(from,{text:"Use:.order MPESACODE BotName"},{quoted:m})
      const verify=await apiCall('verify_payment',{phone:from.split('@')[0], mpesa_code:mpesa, bot_name:botname});
      if(verify.success){ await sock.sendMessage(from,{text:`🎉 Verified! Deploying ${botname}`},{quoted:m}); await deployCustomerBot(from, botname); }
      else{ await apiCall('create_order',{phone:from.split('@')[0], amount:200, bot_name:botname}); await sock.sendMessage(from,{text:`⏳ ${verify.message} - Owner notified`},{quoted:m}); await sock.sendMessage(config.ownerNumber+"@s.whatsapp.net",{text:`🔔 NEW PAYMENT\nFrom:${from}\nCode:${mpesa}\nBot:${botname}\n.approve ${mpesa} ${from.split('@')[0]}`}) }
    }
    if(cmd==='approve' && isOwner){ const parts=text.split(' '); const code=parts[0]?.toUpperCase(); const custPhone=parts[1]; const res=await apiCall('verify_payment',{phone:custPhone||config.ownerNumber, mpesa_code:code}); await sock.sendMessage(from,{text:res.success?`✅ Approved ${code}`:`❌ ${res.message}`},{quoted:m}); if(res.success&&custPhone) await deployCustomerBot(custPhone+'@s.whatsapp.net','GenNextTech Bot') }
  })
}
startMain()