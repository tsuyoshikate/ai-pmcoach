// Shared helpers for the Vercel serverless relay.
// The DeepSeek key only lives in Vercel environment variables and never reaches the browser.
//
// Environment variables (Vercel → Project → Settings → Environment Variables):
//   DEEPSEEK_API_KEY      required. DeepSeek platform API key.
//   DEEPSEEK_MODEL        optional, default "deepseek-v4-flash".
//   KV_REST_API_URL / KV_REST_API_TOKEN            set automatically by the Upstash integration,
//   (or UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN)  used for the daily limits.
//   DAILY_PER_VISITOR     optional, default 15 model calls per visitor per day.
//   DAILY_TOTAL           optional, default 300 model calls for the whole site per day.
// Without a key or a limit store the relay reports "unavailable" and the site keeps using
// its rule-based diagnosis, so a missing setting can never cause unlimited spending.
import { createHmac, createHash, timingSafeEqual } from 'node:crypto';

const env = process.env;
const storeUrl = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
const storeToken = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
const perVisitor = Number(env.DAILY_PER_VISITOR) || 15;
const perDay = Number(env.DAILY_TOTAL) || 300;
const TOKEN_TTL_MS = 30 * 60 * 1000;

export const configured = () => Boolean(env.DEEPSEEK_API_KEY && storeUrl && storeToken);
const secret = () => createHash('sha256').update('ai-pmcoach-session:' + env.DEEPSEEK_API_KEY).digest();

export function issueToken(now = Date.now()) {
  const stamp = String(now);
  return stamp + '.' + createHmac('sha256', secret()).update(stamp).digest('base64url');
}
function validToken(token, now = Date.now()) {
  if (typeof token !== 'string' || !/^\d{13}\.[\w-]{43}$/.test(token)) return false;
  const [stamp, sig] = token.split('.');
  if (now - Number(stamp) > TOKEN_TTL_MS || Number(stamp) > now + 60_000) return false;
  const expected = createHmac('sha256', secret()).update(stamp).digest('base64url');
  return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}
function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return req.headers['sec-fetch-site'] !== 'cross-site';
  try { return new URL(origin).host === req.headers.host; } catch { return false; }
}
function visitorId(req) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  return createHash('sha256').update(ip + ':' + env.DEEPSEEK_API_KEY).digest('hex').slice(0, 24);
}
const today = () => new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10); // China date

// Counts this call against both limits; returns false when either limit is used up.
async function takeQuota(req) {
  const day = today(), v = `pmc:${day}:v:${visitorId(req)}`, all = `pmc:${day}:all`;
  const r = await fetch(storeUrl + '/pipeline', {
    method: 'POST', headers: { Authorization: 'Bearer ' + storeToken, 'Content-Type': 'application/json' },
    body: JSON.stringify([['INCR', v], ['EXPIRE', v, 172800], ['INCR', all], ['EXPIRE', all, 172800]]),
  });
  if (!r.ok) throw Error('limit store unavailable');
  const [vc, , ac] = await r.json();
  return Number(vc.result) <= perVisitor && Number(ac.result) <= perDay;
}

async function callModel(prompt) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 50_000);
  try {
    const r = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST', signal: controller.signal,
      headers: { Authorization: 'Bearer ' + env.DEEPSEEK_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: env.DEEPSEEK_MODEL || 'deepseek-v4-flash', temperature: 0.3, max_tokens: 1800,
        messages: [{ role: 'user', content: prompt }] }),
    });
    if (!r.ok) throw Error('model error ' + r.status);
    const text = (await r.json())?.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || !text.trim() || text.length > 7000) throw Error('invalid model output');
    return text.trim();
  } finally { clearTimeout(timer); }
}

// Wraps one endpoint: checks method, origin, session token and quota, then asks the model.
// buildPrompt receives the request body and must rebuild every prompt from trusted code and
// the question bank; it never forwards text from the browser as an instruction.
export function relay(buildPrompt) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
    if (!configured()) return res.status(503).json({ error: 'unavailable' });
    if (!sameOrigin(req) || !validToken(req.headers['x-ai-session'])) return res.status(403).json({ error: 'forbidden' });
    let prompt;
    try { prompt = buildPrompt(typeof req.body === 'string' ? JSON.parse(req.body) : req.body); } catch { prompt = null; }
    if (typeof prompt !== 'string') return res.status(400).json({ error: 'invalid input' });
    try { if (!(await takeQuota(req))) return res.status(429).json({ error: 'daily limit' }); }
    catch { return res.status(503).json({ error: 'unavailable' }); }
    try { return res.status(200).json({ text: await callModel(prompt) }); }
    catch { return res.status(502).json({ error: 'model unavailable' }); }
  };
}
export function status(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'method' });
  if (!configured() || !sameOrigin(req)) return res.status(503).json({ available: false });
  return res.status(200).json({ available: true, token: issueToken() });
}
