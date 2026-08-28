import crypto from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { ollamaStatus } from './ollama.js';
import { consumeState, createScan, createSession, dbHealth, deleteSession, getLatestScan, getScan, getSession, saveState, saveUser } from './db.js';
import { enqueueScan, queueHealth } from './queue.js';

const COOKIE = 'devtree_session';

function cookies(req: IncomingMessage): Record<string,string> { return Object.fromEntries((req.headers.cookie || '').split(';').filter(Boolean).map(part => part.trim().split('=').map(decodeURIComponent) as [string,string])); }
function json(res: ServerResponse, status: number, data: unknown) { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(data)); }
function redirect(res: ServerResponse, location: string, cookie?: string) { const headers: Record<string,string> = { location }; if (cookie) headers['set-cookie'] = cookie; res.writeHead(302, headers); res.end(); }
function appUrl(req: IncomingMessage) { return process.env.APP_URL || `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`; }
function session(req: IncomingMessage) { return getSession(cookies(req)[COOKIE]); }

export async function handleApiRequest(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url, appUrl(req));
  if (url.pathname === '/api/health') { const [database,queue,ollama]=await Promise.all([dbHealth(),queueHealth(),ollamaStatus()]); return json(res, database&&queue?200:503, { ok: database&&queue, database, queue, oauthConfigured: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET), ollama }); }
  if (url.pathname === '/api/auth/status') {
    const current = await session(req);
    return json(res, 200, { connected: Boolean(current), user: current?.user || null, oauthConfigured: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) });
  }
  if (url.pathname === '/api/auth/github') {
    console.log(`[auth] GitHub authorization started at ${new Date().toISOString()}`);
    if (!process.env.GITHUB_CLIENT_ID) return redirect(res, '/?demo=1');
    const state = crypto.randomBytes(24).toString('hex'); await saveState(state);
    const params = new URLSearchParams({ client_id: process.env.GITHUB_CLIENT_ID, redirect_uri: `${appUrl(req)}/api/auth/callback`, scope: 'read:user repo', state });
    return redirect(res, `https://github.com/login/oauth/authorize?${params}`);
  }
  if (url.pathname === '/api/auth/callback') {
    const state = url.searchParams.get('state');
    if (!state || !await consumeState(state)) return redirect(res, '/?error=oauth_state');
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', { method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json' }, body: JSON.stringify({ client_id: process.env.GITHUB_CLIENT_ID, client_secret: process.env.GITHUB_CLIENT_SECRET, code: url.searchParams.get('code'), redirect_uri: `${appUrl(req)}/api/auth/callback` }) });
    const tokenData = await tokenResponse.json(); if (!tokenData.access_token) return redirect(res, '/?error=oauth_token');
    const userResponse = await fetch('https://api.github.com/user', { headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'DEVTREE' } });
    const user = await userResponse.json(); await saveUser(user, tokenData); const id = await createSession(user.id);
    return redirect(res, '/?connected=1', `${COOKIE}=${id}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${appUrl(req).startsWith('https') ? '; Secure' : ''}`);
  }
  if (url.pathname === '/api/auth/logout' && req.method === 'POST') { const id = cookies(req)[COOKIE]; await deleteSession(id); res.setHeader('set-cookie', `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`); return json(res, 200, { ok: true }); }
  if (url.pathname === '/api/analyze' && req.method === 'POST') {
    const current = await session(req); if (!current) return json(res, 401, { error: 'Connect GitHub before scanning repositories.' });
    const id = await createScan(current.githubId); await enqueueScan(id); return json(res, 202, { id, status: 'queued', stage: 'queued', progress: 0, result: null, error: null });
  }
  if (url.pathname === '/api/scans/latest' && req.method === 'GET') { const current=await session(req); if(!current)return json(res,401,{error:'Authentication required.'}); return json(res,200,await getLatestScan(current.githubId)); }
  const scanMatch = url.pathname.match(/^\/api\/scans\/([0-9a-f-]+)$/);
  if (scanMatch && req.method === 'GET') { const current=await session(req); if(!current)return json(res,401,{error:'Authentication required.'}); const scan=await getScan(scanMatch[1],current.githubId); return scan?json(res,200,scan):json(res,404,{error:'Scan not found.'}); }
  return json(res, 404, { error: 'Not found' });
}
