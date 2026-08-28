import crypto from 'node:crypto';
import { analyzeGitHub } from './analyzer.js';
import { ollamaStatus } from './ollama.js';

const sessions = new Map();
const states = new Map();
const COOKIE = 'devtree_session';

function cookies(req) { return Object.fromEntries((req.headers.cookie || '').split(';').filter(Boolean).map(part => part.trim().split('=').map(decodeURIComponent))); }
function json(res, status, data) { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(data)); }
function redirect(res, location, cookie) { const headers = { location }; if (cookie) headers['set-cookie'] = cookie; res.writeHead(302, headers); res.end(); }
function appUrl(req) { return process.env.APP_URL || `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`; }
function session(req) { return sessions.get(cookies(req)[COOKIE]); }

export async function handleApiRequest(req, res) {
  const url = new URL(req.url, appUrl(req));
  if (url.pathname === '/api/health') return json(res, 200, { ok: true, oauthConfigured: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET), ollama: await ollamaStatus() });
  if (url.pathname === '/api/auth/status') {
    const current = session(req);
    return json(res, 200, { connected: Boolean(current), user: current?.user || null, oauthConfigured: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) });
  }
  if (url.pathname === '/api/auth/github') {
    if (!process.env.GITHUB_CLIENT_ID) return redirect(res, '/?demo=1');
    const state = crypto.randomBytes(24).toString('hex'); states.set(state, Date.now());
    const params = new URLSearchParams({ client_id: process.env.GITHUB_CLIENT_ID, redirect_uri: `${appUrl(req)}/api/auth/callback`, scope: 'read:user repo', state });
    return redirect(res, `https://github.com/login/oauth/authorize?${params}`);
  }
  if (url.pathname === '/api/auth/callback') {
    const state = url.searchParams.get('state'); const created = states.get(state); states.delete(state);
    if (!created || Date.now() - created > 10 * 60_000) return redirect(res, '/?error=oauth_state');
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', { method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json' }, body: JSON.stringify({ client_id: process.env.GITHUB_CLIENT_ID, client_secret: process.env.GITHUB_CLIENT_SECRET, code: url.searchParams.get('code'), redirect_uri: `${appUrl(req)}/api/auth/callback` }) });
    const tokenData = await tokenResponse.json(); if (!tokenData.access_token) return redirect(res, '/?error=oauth_token');
    const userResponse = await fetch('https://api.github.com/user', { headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'DEVTREE' } });
    const user = await userResponse.json(); const id = crypto.randomBytes(32).toString('hex'); sessions.set(id, { token: tokenData.access_token, user: { login: user.login, name: user.name, avatarUrl: user.avatar_url } });
    return redirect(res, '/?connected=1', `${COOKIE}=${id}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400${appUrl(req).startsWith('https') ? '; Secure' : ''}`);
  }
  if (url.pathname === '/api/auth/logout' && req.method === 'POST') { const id = cookies(req)[COOKIE]; sessions.delete(id); res.setHeader('set-cookie', `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`); return json(res, 200, { ok: true }); }
  if (url.pathname === '/api/analyze' && req.method === 'POST') {
    const current = session(req); if (!current) return json(res, 401, { error: 'Connect GitHub before scanning repositories.' });
    try { return json(res, 200, await analyzeGitHub(current.token)); } catch (error) { return json(res, 502, { error: error.message }); }
  }
  return json(res, 404, { error: 'Not found' });
}
