const crypto=require('node:crypto');
const {decrypt}=require('./secrets');
let mailer;

function mail(){
  if(mailer)return mailer;
  if(!process.env.SMTP_HOST||!process.env.SMTP_USER||!process.env.SMTP_PASS)return null;
  const nodemailer=require('nodemailer');
  mailer=nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||465),secure:process.env.SMTP_SECURE!=='false',auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS},tls:{minVersion:'TLSv1.2'},connectionTimeout:8000,greetingTimeout:8000,socketTimeout:10000});
  return mailer;
}
function emailConfigured(){return Boolean((process.env.RESEND_API_KEY&&(process.env.EMAIL_FROM||process.env.SMTP_FROM))||mail());}
async function sendEmail({to,subject,text,html}){
  if(process.env.RESEND_API_KEY){
    const from=process.env.EMAIL_FROM||process.env.SMTP_FROM;
    if(!from)throw new Error('EMAIL_FROM is required when RESEND_API_KEY is set.');
    const response=await fetch('https://api.resend.com/emails',{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),headers:{authorization:`Bearer ${process.env.RESEND_API_KEY}`,'content-type':'application/json'},body:JSON.stringify({from,to:Array.isArray(to)?to:[to],subject,text,html})});
    if(!response.ok)throw new Error(`Email API returned HTTP ${response.status}.`);
    return response.json();
  }
  const transport=mail();
  if(!transport)throw new Error('Email delivery is not configured.');
  return transport.sendMail({from:process.env.EMAIL_FROM||process.env.SMTP_FROM||process.env.SMTP_USER,to,subject,text,html});
}
function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

/* ── Unsubscribe token helpers ───────────────────────────────────────────── */
// A simple HMAC-signed token: base64url(tenantId):base64url(HMAC)
// No DB table needed — verifiable from RATE_LIMIT_SECRET at any time.
function makeUnsubscribeToken(tenantId){
  const secret=process.env.RATE_LIMIT_SECRET||'fallback-secret';
  const mac=crypto.createHmac('sha256',secret).update(`unsub:${tenantId}`).digest('base64url');
  return `${Buffer.from(tenantId).toString('base64url')}.${mac}`;
}
function verifyUnsubscribeToken(token){
  try{
    const [idB64]=String(token||'').split('.');
    const tenantId=Buffer.from(idB64,'base64url').toString('utf8');
    const expected=makeUnsubscribeToken(tenantId);
    if(!crypto.timingSafeEqual(Buffer.from(token),Buffer.from(expected)))return null;
    return tenantId;
  }catch{return null;}
}

/* ── Unsubscribe footer ──────────────────────────────────────────────────── */
function unsubscribeFooterText(tenantId){
  const base=process.env.APP_BASE_URL||'http://localhost:3000';
  const token=makeUnsubscribeToken(tenantId);
  return `\n\n---\nYou are receiving this because you enabled email alerts in RootCause.\nTo stop incident emails: ${base}/api/unsubscribe?token=${token}`;
}
function unsubscribeFooterHtml(tenantId){
  const base=process.env.APP_BASE_URL||'http://localhost:3000';
  const token=makeUnsubscribeToken(tenantId);
  const url=`${escapeHtml(base)}/api/unsubscribe?token=${escapeHtml(token)}`;
  return `<hr style="margin:28px 0;border:none;border-top:1px solid #ddd"><p style="font-size:11px;color:#888;margin:0">You receive this alert because email alerts are enabled in your <a href="${escapeHtml(base)}/dashboard.html#account">RootCause workspace</a>. <a href="${url}">Unsubscribe from incident emails</a>.</p>`;
}

async function slack(url,incident){if(!/^https:\/\/hooks\.slack\.com\/services\/[A-Z0-9]+\/[A-Z0-9]+\/[A-Za-z0-9]+$/.test(url))throw new Error('Slack webhook URL format is invalid.');const r=await fetch(url,{method:'POST',redirect:'error',signal:AbortSignal.timeout(8000),headers:{'content-type':'application/json'},body:JSON.stringify({text:`RootCause ${incident.type}: ${incident.title}\n${incident.cause}\nApp: ${incident.appName} · Confidence: ${incident.confidence}`})});if(!r.ok)throw new Error(`Slack returned HTTP ${r.status}`);}
async function telegram(token,chat,incident){if(!/^\d{5,15}:[A-Za-z0-9_-]{20,}$/.test(token)||!/^(@[A-Za-z0-9_]{5,}|-?\d{5,20})$/.test(chat))throw new Error('Telegram bot token or chat identifier is invalid.');const r=await fetch(`https://api.telegram.org/bot${token}/sendMessage`,{method:'POST',redirect:'error',signal:AbortSignal.timeout(8000),headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:chat,text:`RootCause ${incident.type}: ${incident.title}\n${incident.cause}\nApp: ${incident.appName} · Confidence: ${incident.confidence}`})});if(!r.ok)throw new Error(`Telegram returned HTTP ${r.status}`);}

async function deliver(pool,incident){
  const [tenant,settings]=await Promise.all([pool.query('SELECT email FROM tenants WHERE id=$1',[incident.tenantId]),pool.query('SELECT * FROM notification_settings WHERE tenant_id=$1',[incident.tenantId])]);
  const userEmail=tenant.rows[0]?.email;if(!userEmail)return;const s=settings.rows[0]||{};
  const evidence=(incident.evidence||[]).map(e=>`${e.timestamp} ${e.level} ${e.service}: ${e.message}`).join('\n');
  const unsub=unsubscribeFooterText(incident.tenantId);
  const unsubHtml=unsubscribeFooterHtml(incident.tenantId);
  const channels=[];
  if(s.email_enabled&&emailConfigured())channels.push(['email',()=>sendEmail({to:userEmail,subject:`RootCause ${incident.severity}: ${incident.title}`,text:`${incident.cause}\n\nApp: ${incident.appName}\nConfidence: ${incident.confidence}\n\nEvidence:\n${evidence}${unsub}`,html:`<h2>${escapeHtml(incident.title)}</h2><p>${escapeHtml(incident.cause)}</p><p>App: ${escapeHtml(incident.appName)} · Confidence: ${escapeHtml(incident.confidence)}</p><pre style="background:#f5f5f5;padding:12px;border-radius:5px;font-size:12px;overflow:auto">${escapeHtml(evidence)}</pre>${unsubHtml}`})]);
  if(s.slack_webhook_enc)channels.push(['slack',()=>slack(decrypt(s.slack_webhook_enc),incident)]);
  if(s.telegram_token_enc&&s.telegram_chat_enc)channels.push(['telegram',()=>telegram(decrypt(s.telegram_token_enc),decrypt(s.telegram_chat_enc),incident)]);
  for(const [channel,send] of channels){const slot=Math.floor(Date.now()/1_800_000);const dedupe=`${incident.id}:${channel}:${slot}`;try{await send();await pool.query('INSERT INTO notifications(id,tenant_id,incident_id,channel,status,dedupe_key) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(dedupe_key) DO NOTHING',[crypto.randomUUID(),incident.tenantId,incident.id,channel,'sent',dedupe]);}catch(error){await pool.query('INSERT INTO notifications(id,tenant_id,incident_id,channel,status,error,dedupe_key) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(dedupe_key) DO NOTHING',[crypto.randomUUID(),incident.tenantId,incident.id,channel,'failed',String(error.message).slice(0,250),dedupe]).catch(()=>{});}}
}

/* ── RBI e-mandate: send renewal warning 24h before auto-charge ──────────── */
// Called once per analyzer cycle. Finds subscriptions renewing in the next
// 23–25 hour window (so a 60-minute analyzer cycle can't double-send) and
// mails a pre-debit notice. Uses payment_events as dedup storage.
async function sendRenewalNotices(pool){
  if(!emailConfigured())return;
  // Find active subscriptions renewing between now+23h and now+25h
  const due=await pool.query(
    `SELECT s.tenant_id,s.current_period_end,s.plan_code,t.email,t.name
     FROM subscriptions s
     JOIN tenants t ON t.id=s.tenant_id
     WHERE s.status='active'
       AND s.cancel_at_cycle_end=false
       AND s.current_period_end BETWEEN now()+interval '23 hours' AND now()+interval '25 hours'`
  );
  for(const row of due.rows){
    // Dedup key: one renewal notice per subscription period
    const dedupeKey=`renewal-notice:${row.tenant_id}:${row.current_period_end.toISOString().slice(0,10)}`;
    const already=await pool.query(
      `SELECT razorpay_event_id FROM payment_events WHERE razorpay_event_id=$1`,[dedupeKey]
    );
    if(already.rowCount)continue; // already sent for this period
    const renewDate=new Date(row.current_period_end).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'});
    const planName=row.plan_code==='team'?'Plus':'Prime';
    const priceInr=row.plan_code==='team'?'₹199':'₹299';
    const base=process.env.APP_BASE_URL||'http://localhost:3000';
    const unsubUrl=`${base}/api/unsubscribe?token=${makeUnsubscribeToken(row.tenant_id)}`;
    const cancelUrl=`${base}/dashboard.html#billing`;
    try{
      await sendEmail({
        to:row.email,
        subject:`RootCause ${planName} renews tomorrow — pre-debit notice`,
        text:`Hi ${row.name},\n\nAs required by RBI guidelines, we are writing to let you know that your RootCause ${planName} subscription (${priceInr}/month) is scheduled to auto-renew on ${renewDate}.\n\nIf you do not wish to renew, you can cancel before the renewal date at:\n${cancelUrl}\n\nIf you have already cancelled, no action is needed — your access continues until the period ends.\n\nThank you for using RootCause.\nThe RootCause team\n\n---\nThis is a mandatory pre-debit notification required by RBI recurring payment guidelines.\nTo unsubscribe from non-mandatory emails: ${unsubUrl}`,
        html:`<p>Hi ${escapeHtml(row.name)},</p><p>As required by RBI guidelines, we are writing to let you know that your <strong>RootCause ${escapeHtml(planName)}</strong> subscription (<strong>${escapeHtml(priceInr)}/month</strong>) is scheduled to auto-renew on <strong>${escapeHtml(renewDate)}</strong>.</p><p>If you do not wish to renew, <a href="${escapeHtml(cancelUrl)}">cancel before the renewal date</a>. If you have already cancelled, no action is needed — your access continues until the period ends.</p><p>Thank you for using RootCause.<br>The RootCause team</p><hr style="margin:24px 0;border:none;border-top:1px solid #ddd"><p style="font-size:11px;color:#888">This is a mandatory pre-debit notification required by RBI recurring payment guidelines. <a href="${escapeHtml(unsubUrl)}">Unsubscribe from non-mandatory emails</a>.</p>`
      });
      // Record sent so we don't send again this cycle
      await pool.query(
        `INSERT INTO payment_events(razorpay_event_id,event_type,payload) VALUES($1,'renewal_notice',$2) ON CONFLICT DO NOTHING`,
        [dedupeKey,JSON.stringify({tenantId:row.tenant_id,renewDate,plan:row.plan_code})]
      );
      console.log(`Renewal notice sent to ${row.email} for period ending ${renewDate}`);
    }catch(error){
      console.error(`Failed to send renewal notice to ${row.email}:`,error.message);
    }
  }
}

async function testDelivery(pool,tenantId){
  const [tenant,settings]=await Promise.all([pool.query('SELECT email FROM tenants WHERE id=$1',[tenantId]),pool.query('SELECT * FROM notification_settings WHERE tenant_id=$1',[tenantId])]);
  const email=tenant.rows[0]?.email,s=settings.rows[0]||{},channels=[];
  if(s.email_enabled&&emailConfigured()&&email)channels.push(['email',()=>sendEmail({to:email,subject:'RootCause test notification',text:'Your RootCause email alert destination is working. This is a test message; no incident was created.'})]);
  if(s.slack_webhook_enc)channels.push(['slack',()=>slack(decrypt(s.slack_webhook_enc),{type:'test',title:'Test notification',cause:'Your RootCause Slack destination is working.',appName:'RootCause',confidence:'High'})]);
  if(s.telegram_token_enc&&s.telegram_chat_enc)channels.push(['telegram',()=>telegram(decrypt(s.telegram_token_enc),decrypt(s.telegram_chat_enc),{type:'test',title:'Test notification',cause:'Your RootCause Telegram destination is working.',appName:'RootCause',confidence:'High'})]);
  if(!channels.length)return {configured:0,results:[]};
  const results=await Promise.all(channels.map(async([channel,send])=>{try{await send();return {channel,status:'sent'}}catch{return {channel,status:'failed',message:'Delivery failed. Check the integration settings and server configuration.'}}}));
  return {configured:channels.length,results};
}
async function testEmail(pool,tenantId){
  if(!emailConfigured())return {configured:false,sent:false,message:'Email delivery is not configured on the server.'};
  const q=await pool.query('SELECT email FROM tenants WHERE id=$1',[tenantId]),to=q.rows[0]?.email;if(!to)return {configured:true,sent:false,message:'The account email address is unavailable.'};
  try{await sendEmail({to,subject:'RootCause email delivery test',text:'Email delivery is working for your RootCause workspace. This is a test message; no incident was created.'});return {configured:true,sent:true};}
  catch(error){if(process.env.RESEND_API_KEY)console.error('Email API test delivery failed:',error.message);else console.error('SMTP test delivery failed:',{code:error.code,responseCode:error.responseCode,command:error.command,syscall:error.syscall,address:error.address,port:error.port});return {configured:true,sent:false,message:'Email delivery failed. Check provider credentials, sender authorization, and service logs.'};}
}
async function sendPasswordReset(email,resetUrl){if(!emailConfigured())return false;await sendEmail({to:email,subject:'Reset your RootCause password',text:`A password reset was requested for this account. Use this one-time link within 30 minutes:\n\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,html:`<p>A password reset was requested for this account.</p><p><a href="${escapeHtml(resetUrl)}">Reset your RootCause password</a></p><p>This one-time link expires in 30 minutes. If you did not request this, ignore this email.</p>`});return true;}
module.exports={deliver,testDelivery,testEmail,sendPasswordReset,emailConfigured,sendRenewalNotices,verifyUnsubscribeToken};
