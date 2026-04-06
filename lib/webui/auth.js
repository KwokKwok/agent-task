import { createHmac, timingSafeEqual } from 'node:crypto';

const SESSION_COOKIE = 'ai_task_webui_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

function sign(payload, secret) {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

function b64urlEncode(input) {
  return Buffer.from(input, 'utf-8').toString('base64url');
}

function b64urlDecode(input) {
  return Buffer.from(input, 'base64url').toString('utf-8');
}

function parseCookies(cookieHeader) {
  if (!cookieHeader) return {};
  return cookieHeader
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)
    .reduce((acc, pair) => {
      const idx = pair.indexOf('=');
      if (idx === -1) return acc;
      const key = pair.slice(0, idx).trim();
      const val = pair.slice(idx + 1).trim();
      acc[key] = val;
      return acc;
    }, {});
}

function safeEqualString(a, b) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

export function createSessionCookie(token) {
  const exp = Date.now() + SESSION_TTL_MS;
  const payload = JSON.stringify({ exp });
  const payloadEncoded = b64urlEncode(payload);
  const sig = sign(payloadEncoded, token);
  const value = `${payloadEncoded}.${sig}`;
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function validateSession(req, token) {
  const cookies = parseCookies(req.headers.cookie);
  const raw = cookies[SESSION_COOKIE];
  if (!raw || !token) return false;

  const dot = raw.lastIndexOf('.');
  if (dot <= 0) return false;

  const payloadEncoded = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  const expected = sign(payloadEncoded, token);
  if (!safeEqualString(sig, expected)) return false;

  try {
    const payload = JSON.parse(b64urlDecode(payloadEncoded));
    if (!payload.exp || Number(payload.exp) < Date.now()) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function isTokenValid(input, token) {
  if (!input || !token) return false;
  return safeEqualString(String(input), String(token));
}
