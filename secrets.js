const crypto = require('node:crypto');
function key(){const raw=process.env.APP_ENCRYPTION_KEY||'';const out=Buffer.from(raw,'base64');if(out.length!==32)throw new Error('Set APP_ENCRYPTION_KEY to a base64 encoded 32-byte random value before saving notification credentials.');return out;}
function encrypt(value){if(!value)return null;const iv=crypto.randomBytes(12);const cipher=crypto.createCipheriv('aes-256-gcm',key(),iv);const data=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);return [iv.toString('base64url'),cipher.getAuthTag().toString('base64url'),data.toString('base64url')].join('.');}
function decrypt(value){if(!value)return '';const [i,t,d]=value.split('.');const decipher=crypto.createDecipheriv('aes-256-gcm',key(),Buffer.from(i,'base64url'));decipher.setAuthTag(Buffer.from(t,'base64url'));return Buffer.concat([decipher.update(Buffer.from(d,'base64url')),decipher.final()]).toString('utf8');}
module.exports={encrypt,decrypt};
