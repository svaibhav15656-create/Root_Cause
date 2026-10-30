'use strict';

const zlib = require('node:zlib');

const MAX_FILES = 500;
const MAX_ARCHIVE_BYTES = 8 * 1024 * 1024;
const MAX_EXPANDED_BYTES = 24 * 1024 * 1024;
const MAX_FILE_BYTES = 1024 * 1024;
const SOURCE_EXT = /\.(?:js|jsx|ts|tsx|mjs|cjs|py|rb|php|java|go|rs|cs|sql|html|sh|yml|yaml|json|env\.example|toml)$/i;

function safeName(value) {
  return String(value).replace(/\\/g, '/').split('/').every(part => part !== '..') && !String(value).startsWith('/') && !/^[A-Za-z]:/.test(String(value));
}

function unzipTextFiles(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length > MAX_ARCHIVE_BYTES) throw new Error('ZIP must be 8 MB or smaller.');
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('This is not a supported ZIP archive.');
  const count = buffer.readUInt16LE(eocd + 10), centralOffset = buffer.readUInt32LE(eocd + 16);
  if (!count || count > MAX_FILES || centralOffset >= buffer.length) throw new Error('ZIP has no files or contains too many entries.');
  const files = [];
  let cursor = centralOffset, expanded = 0;
  for (let i = 0; i < count; i++) {
    if (cursor + 46 > buffer.length || buffer.readUInt32LE(cursor) !== 0x02014b50) throw new Error('ZIP directory is invalid.');
    const method = buffer.readUInt16LE(cursor + 10), compressedSize = buffer.readUInt32LE(cursor + 20), size = buffer.readUInt32LE(cursor + 24);
    const nameLen = buffer.readUInt16LE(cursor + 28), extraLen = buffer.readUInt16LE(cursor + 30), commentLen = buffer.readUInt16LE(cursor + 32), localOffset = buffer.readUInt32LE(cursor + 42);
    const name = buffer.toString('utf8', cursor + 46, cursor + 46 + nameLen);
    cursor += 46 + nameLen + extraLen + commentLen;
    if (!safeName(name) || name.endsWith('/') || !SOURCE_EXT.test(name) || size > MAX_FILE_BYTES) continue;
    if (![0, 8].includes(method) || localOffset + 30 > buffer.length || buffer.readUInt32LE(localOffset) !== 0x04034b50) continue;
    const localNameLen = buffer.readUInt16LE(localOffset + 26), localExtraLen = buffer.readUInt16LE(localOffset + 28), start = localOffset + 30 + localNameLen + localExtraLen;
    if (start + compressedSize > buffer.length) throw new Error('ZIP file data is invalid.');
    const packed = buffer.subarray(start, start + compressedSize);
    const text = method === 0 ? packed : zlib.inflateRawSync(packed, { maxOutputLength: MAX_FILE_BYTES });
    if (text.length > MAX_FILE_BYTES || (text.length && text.includes(0))) continue;
    expanded += text.length;
    if (expanded > MAX_EXPANDED_BYTES) throw new Error('ZIP expands beyond the 24 MB scan limit.');
    files.push({ path: name, text: text.toString('utf8') });
  }
  if (!files.length) throw new Error('No supported text source files were found in the ZIP.');
  return files;
}

const rules = [
  // ── A01 · Broken Access Control ───────────────────────────────────────────
  { id:'A01', severity:'high',   title:'Possible unprotected admin or internal route', re:/(?:app|router)\s*\.\s*(?:get|post|put|patch|delete)\s*\(\s*['"`][^'"`]*(?:admin|internal|debug|superuser|backstage|staff|manage)[^'"`]*['"`]/i, fix:'Ensure every privileged route checks the caller\'s role or session before processing the request. Move admin routes behind a separate authenticated middleware.' },
  { id:'A01', severity:'medium', title:'Direct object reference without ownership check', re:/(?:findById|findOne|get|query)\s*\([^)]*(?:req\.(?:params|query|body)\.(?:id|userId|accountId|orderId|customerId))/i, fix:'After fetching a record by ID from user input, verify that the authenticated user owns or has permission to access that record before returning it.' },
  { id:'A01', severity:'medium', title:'CORS wildcard origin may expose private API', re:/(?:Access-Control-Allow-Origin\s*:\s*['"`]\*['"`]|cors\s*\(\s*\)(?!\s*\/))/i, fix:'Restrict CORS to a specific list of trusted origins. A wildcard "*" allows any website to make credentialed requests to your API.' },
  // ── A04 · Insecure Design — missing rate limiting ──────────────────────────
  { id:'A04', severity:'medium', title:'Auth route may lack rate limiting', re:/(?:app|router)\s*\.\s*post\s*\(\s*['"`][^'"`]*(?:login|signin|register|signup|password|forgot|reset|otp|verify)[^'"`]*['"`]/i, fix:'Apply a strict rate limit (e.g. 5–10 requests per minute per IP) to all authentication and password-reset endpoints to prevent brute-force attacks.' },
  { id:'A04', severity:'low',    title:'No apparent input size limit on upload route', re:/(?:multer|formidable|busboy|multipart)\s*\(/i, fix:'Set explicit file size and field count limits on file upload middleware (e.g. limits: { fileSize: 5 * 1024 * 1024 }) to prevent denial-of-service via oversized uploads.' },
  // ── A06 · Vulnerable & Outdated Components ────────────────────────────────
  { id:'A06', severity:'high',   title:'Use of a known-dangerous package', re:/require\s*\(\s*['"`](?:node-serialize|serialize-javascript@[0-2]\.|vm2|electron-eval|eval5|safer-eval)['"`]\s*\)/i, fix:'Remove or replace this package. node-serialize and similar packages have known arbitrary code execution vulnerabilities. Check npm audit and replace with a maintained, safe alternative.' },
  { id:'A06', severity:'medium', title:'Package lock file or manifest may be missing', re:/require\s*\(\s*['"`]\.\.?\/.*['"`]\s*\)\s*\/\/\s*TODO|FIXME.*dep(?:endenc)?|npm\s+install\s+--no-save/i, fix:'Always commit a lock file (package-lock.json, yarn.lock) and audit dependencies regularly with `npm audit`. Pin versions and update frequently.' },
  // ── A02 · Cryptographic Failures (additional) ─────────────────────────────
  { id:'A02', severity:'high',   title:'Possible hard-coded credential', re:/\b(?:api[_-]?key|secret|password|token)\s*[:=]\s*['"][^'"\s]{8,}['"]/i, fix:'Move credentials into a secret manager or environment variable, and rotate any real credential found in source.' },
  // ── A03 · Injection ───────────────────────────────────────────────────────
  { id:'A03', severity:'high',   title:'Dynamic code execution', re:/\beval\s*\(|new\s+Function\s*\(/i, fix:'Avoid evaluating strings as code. Use an explicit parser or a fixed set of operations.' },
  { id:'A03', severity:'high',   title:'Possible unsafe HTML insertion', re:/\.(?:innerHTML|outerHTML)\s*=|dangerouslySetInnerHTML\s*=/i, fix:'Use text rendering by default and sanitize untrusted HTML with a maintained allowlist sanitizer.' },
  { id:'A03', severity:'medium', title:'Possible SQL built from string concatenation', re:/\b(?:SELECT|INSERT|UPDATE|DELETE)\b[^\n;]{0,160}(?:\+\s*\w+|\$\{[^}]+\}|%s)/i, fix:'Use parameterized queries and bind values separately from SQL text.' },
  // ── A05 · Security Misconfiguration ──────────────────────────────────────
  { id:'A05', severity:'medium', title:'TLS verification appears disabled', re:/rejectUnauthorized\s*:\s*false|verify\s*=\s*False/i, fix:'Enable certificate verification. Do not disable TLS checks outside isolated local testing.' },
  // ── A07 · Identification and Authentication Failures ─────────────────────
  { id:'A07', severity:'medium', title:'Weak or insecure password handling', re:/(?:md5|sha1)\s*\([^\n]*(?:password|passwd)|password\s*===?\s*['"]/i, fix:'Use a password hashing function such as scrypt, bcrypt, or Argon2 with a unique salt; compare securely.' },
  // ── A08 · Software and Data Integrity Failures ───────────────────────────
  { id:'A08', severity:'medium', title:'Potentially unsafe deserialization', re:/pickle\.loads?\s*\(|yaml\.load\s*\(|ObjectInputStream\s*\(/i, fix:'Avoid deserializing untrusted input. Use safe parsers and validate the resulting schema.' },
  // ── A09 · Security Logging and Monitoring Failures ───────────────────────
  { id:'A09', severity:'low',    title:'Sensitive data may be written to logs', re:/console\.(?:log|error)\s*\([^\n]*(?:password|token|secret|authorization)/i, fix:'Redact credentials and personal data before logging; restrict access and retention.' },
  // ── A10 · Server-Side Request Forgery ────────────────────────────────────
  { id:'A10', severity:'medium', title:'Possible shell command injection', re:/\b(?:exec|execSync|spawn|system|popen)\s*\([^\n]*(?:\+\s*\w+|\$\{[^}]+\}|\%s)/i, fix:'Prefer argument arrays and fixed executables; validate input and avoid invoking a shell.' }
];

function scanFiles(files, pathFilter = '') {
  const normalizedFilter=String(pathFilter||'').replace(/\\/g,'/').replace(/^\/+|\/+$/g,'');
  if(normalizedFilter.split('/').includes('..'))throw new Error('Review path cannot contain parent-directory segments.');
  const candidates=normalizedFilter?files.filter(file=>{const path=file.path.replace(/\\/g,'/').replace(/^\/+/,''),withoutRoot=path.replace(/^[^/]+\//,'');return path===normalizedFilter||withoutRoot===normalizedFilter||path.endsWith(`/${normalizedFilter}`)||withoutRoot.startsWith(`${normalizedFilter}/`)}):files;
  if(normalizedFilter&&!candidates.length)throw new Error('That folder or file was not found in the repository archive.');
  const findings = [], seen = new Set();
  for (const file of candidates.slice(0, MAX_FILES)) {
    const lines = file.text.split(/\r?\n/);
    for (let index = 0; index < lines.length; index++) {
      for (const rule of rules) {
        if (rule.re.test(lines[index])) {
          const key = `${rule.id}:${rule.title}:${file.path}:${index + 1}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const evidence = lines[index].trim().slice(0, 240).replace(/(Bearer\s+)[A-Za-z0-9._~+/-]+=*/gi, '$1[REDACTED]').replace(/(password|passwd|token|api[_-]?key|secret)(\s*[:=]\s*)[^\s,;]+/gi, '$1$2[REDACTED]');
          findings.push({ id: rule.id, severity: rule.severity, title: rule.title, file: file.path, line: index + 1, evidence, recommendation: rule.fix });
          if (findings.length >= 300) break;
        }
      }
      if (findings.length >= 300) break;
    }
    if (findings.length >= 300) break;
  }
  const rank = { critical:0, high:1, medium:2, low:3 };
  findings.sort((a,b)=>(rank[a.severity]??9)-(rank[b.severity]??9));
  return { filesScanned:Math.min(candidates.length,MAX_FILES), findings, disclaimer:'Automated pattern checks can miss vulnerabilities and may flag safe code. Review each finding in context; this is not a full penetration test or security certification.', checkedAt:new Date().toISOString() };
}

module.exports = { unzipTextFiles, scanFiles, MAX_ARCHIVE_BYTES };
