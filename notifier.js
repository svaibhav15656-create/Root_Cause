const crypto=require('node:crypto');
const {decrypt}=require('./secrets');
let mailer;
function mail(){if(mailer)return mailer;if(!process.env.SMTP_HOST||!process.env.SMTP_USER||!process.env.SMTP_PASS)return null;const nodemailer=require('nodemailer');mailer=nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||465),secure:process.env.SMTP_SECURE!=='false',auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS},tls:{minVersion:'TLSv1.2'},connectionTimeout:8000,greetingTimeout:8000,socketTimeout:10000});return mailer;}
function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
async function slack(url,incident){if(!/^https:\/\/hooks\.slack\.com\/services\/[A-Z0-9]+\/[A-Z0-9]+\/[A-Za-z0-9]+$/.test(url))throw new Error('Slack webhook URL format is invalid.');const r=await fetch(url,{method:'POST',redirect:'error',signal:AbortSignal.timeout(8000),headers:{'content-type':'application/json'},body:JSON.stringify({text:`RootCause ${incident.type}: ${incident.title}\n${incident.cause}\nApp: ${incident.appName} · Confidence: ${incident.confidence}`})});if(!r.ok)throw new Error(`Slack returned HTTP ${r.status}`);}
async function telegram(token,chat,incident){if(!/^\d{5,15}:[A-Za-z0-9_-]{20,}$/.test(token)||!/^(@[A-Za-z0-9_]{5,}|-?\d{5,20})$/.test(chat))throw new Error('Telegram bot token or chat identifier is invalid.');const r=await fetch(`https://api.telegram.org/bot${token}/sendMessage`,{method:'POST',redirect:'error',signal:AbortSignal.timeout(8000),headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:chat,text:`RootCause ${incident.type}: ${incident.title}\n${incident.cause}\nApp: ${incident.appName} · Confidence: ${incident.confidence}`})});if(!r.ok)throw new Error(`Telegram returned HTTP ${r.status}`);}
async function deliver(pool,incident){
  const [tenant,settings]=await Promise.all([pool.query('SELECT email FROM tenants WHERE id=$1',[incident.tenantId]),pool.query('SELECT * FROM notification_settings WHERE tenant_id=$1',[incident.tenantId])]);
  const userEmail=tenant.rows[0]?.email;if(!userEmail)return;const s=settings.rows[0]||{};
  const channels=[];if(s.email_enabled&&mail())channels.push(['email',()=>mail().sendMail({from:process.env.SMTP_FROM||process.env.SMTP_USER,to:userEmail,subject:`RootCause ${incident.severity}: ${incident.title}`,text:`${incident.cause}\n\nApp: ${incident.appName}\nConfidence: ${incident.confidence}\n\nEvidence:\n${(incident.evidence||[]).map(e=>`${e.timestamp} ${e.level} ${e.service}: ${e.message}`).join('\n')}`,html:`<h2>${escapeHtml(incident.title)}</h2><p>${escapeHtml(incident.cause)}</p><p>App: ${escapeHtml(incident.appName)} · Confidence: ${escapeHtml(incident.confidence)}</p><pre>${escapeHtml((incident.evidence||[]).map(e=>`${e.timestamp} ${e.level} ${e.service}: ${e.message}`).join('\n'))}</pre>`})]);
  if(s.slack_webhook_enc)channels.push(['slack',()=>slack(decrypt(s.slack_webhook_enc),incident)]);
  if(s.telegram_token_enc&&s.telegram_chat_enc)channels.push(['telegram',()=>telegram(decrypt(s.telegram_token_enc),decrypt(s.telegram_chat_enc),incident)]);
  for(const [channel,send] of channels){const slot=Math.floor(Date.now()/1_800_000);const dedupe=`${incident.id}:${channel}:${slot}`;
    try{await send();await pool.query('INSERT INTO notifications(id,tenant_id,incident_id,channel,status,dedupe_key) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(dedupe_key) DO NOTHING',[crypto.randomUUID(),incident.tenantId,incident.id,channel,'sent',dedupe]);}
    catch(error){await pool.query('INSERT INTO notifications(id,tenant_id,incident_id,channel,status,error,dedupe_key) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(dedupe_key) DO NOTHING',[crypto.randomUUID(),incident.tenantId,incident.id,channel,'failed',String(error.message).slice(0,250),dedupe]).catch(()=>{});}
  }
}
async function testDelivery(pool,tenantId){
  const [tenant,settings]=await Promise.all([pool.query('SELECT email FROM tenants WHERE id=$1',[tenantId]),pool.query('SELECT * FROM notification_settings WHERE tenant_id=$1',[tenantId])]);
  const email=tenant.rows[0]?.email,s=settings.rows[0]||{},channels=[];
  if(s.email_enabled&&mail()&&email)channels.push(['email',()=>mail().sendMail({from:process.env.SMTP_FROM||process.env.SMTP_USER,to:email,subject:'RootCause test notification',text:'Your RootCause email alert destination is working. This is a test message; no incident was created.'})]);
  if(s.slack_webhook_enc)channels.push(['slack',()=>slack(decrypt(s.slack_webhook_enc),{type:'test',title:'Test notification',cause:'Your RootCause Slack destination is working.',appName:'RootCause',confidence:'High'})]);
  if(s.telegram_token_enc&&s.telegram_chat_enc)channels.push(['telegram',()=>telegram(decrypt(s.telegram_token_enc),decrypt(s.telegram_chat_enc),{type:'test',title:'Test notification',cause:'Your RootCause Telegram destination is working.',appName:'RootCause',confidence:'High'})]);
  if(!channels.length)return {configured:0,results:[]};
  const results=await Promise.all(channels.map(async([channel,send])=>{try{await send();return {channel,status:'sent'}}catch{return {channel,status:'failed',message:'Delivery failed. Check the integration settings and server configuration.'}}}));
  return {configured:channels.length,results};
}
async function testSmtp(pool,tenantId){
  const transport=mail();if(!transport)return {configured:false,sent:false,message:'SMTP is not configured on the server.'};
  const q=await pool.query('SELECT email FROM tenants WHERE id=$1',[tenantId]),to=q.rows[0]?.email;if(!to)return {configured:true,sent:false,message:'The account email address is unavailable.'};
  try{await transport.sendMail({from:process.env.SMTP_FROM||process.env.SMTP_USER,to,subject:'RootCause SMTP test',text:'SMTP delivery is working for your RootCause workspace. This is a test message; no incident was created.'});return {configured:true,sent:true}}
  catch{return {configured:true,sent:false,message:'SMTP delivery failed. Check the host, port, TLS mode, credentials, and authorized sender address.'}}
}
async function sendPasswordReset(email,resetUrl){const transport=mail();if(!transport)return false;await transport.sendMail({from:process.env.SMTP_FROM||process.env.SMTP_USER,to:email,subject:'Reset your RootCause password',text:`A password reset was requested for this account. Use this one-time link within 30 minutes:\n\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,html:`<p>A password reset was requested for this account.</p><p><a href="${escapeHtml(resetUrl)}">Reset your RootCause password</a></p><p>This one-time link expires in 30 minutes. If you did not request this, ignore this email.</p>`});return true;}
module.exports={deliver,testDelivery,testSmtp,sendPasswordReset};
