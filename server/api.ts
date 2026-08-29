import crypto from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { ollamaStatus } from './ollama.js';
import { acceptedQuestsForRepository, consumeState, createScan, createSession, dbHealth, deleteSession, getCareerTarget, getCurrentQuest, getLatestScan, getPassportSettings, getPublicPassport, getScan, getSession, registerWebhookDelivery, saveCareerTarget, saveQuest, saveState, saveUser, setPassportPublic } from './db.js';
import { enqueueScan, queueHealth } from './queue.js';
import { recommendQuest } from './quests.js';
import { generateCareerTarget } from './career.js';
import type { AnalysisResult, PublicPassport } from '../shared/types.js';

const COOKIE = 'devtree_session';

function cookies(req: IncomingMessage): Record<string,string> { return Object.fromEntries((req.headers.cookie || '').split(';').filter(Boolean).map(part => part.trim().split('=').map(decodeURIComponent) as [string,string])); }
function json(res: ServerResponse, status: number, data: unknown) { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(data)); }
function redirect(res: ServerResponse, location: string, cookie?: string) { const headers: Record<string,string> = { location }; if (cookie) headers['set-cookie'] = cookie; res.writeHead(302, headers); res.end(); }
function appUrl(req: IncomingMessage) { return process.env.APP_URL || `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`; }
function session(req: IncomingMessage) { return getSession(cookies(req)[COOKIE]); }
async function rawBody(req:IncomingMessage):Promise<Buffer>{const chunks:Buffer[]=[];let size=0;for await(const chunk of req){const value=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);size+=value.length;if(size>2_000_000)throw new Error('Request body exceeds the 2 MB limit.');chunks.push(value)}return Buffer.concat(chunks)}
async function jsonBody<T>(req:IncomingMessage):Promise<T>{const body=await rawBody(req);return JSON.parse(body.toString('utf8')||'{}') as T}
export function verifyWebhookSignature(body:Buffer,signature:string|undefined,secret=process.env.GITHUB_WEBHOOK_SECRET):boolean{if(!secret||!signature)return false;const expected=`sha256=${crypto.createHmac('sha256',secret).update(body).digest('hex')}`;return expected.length===signature.length&&crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(signature))}

export async function handleApiRequest(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url||'/', appUrl(req));
  if(url.pathname==='/api/webhooks/github'&&req.method==='POST'){
    const body=await rawBody(req);if(!verifyWebhookSignature(body,req.headers['x-hub-signature-256'] as string|undefined))return json(res,401,{error:'Invalid webhook signature.'});
    const event=String(req.headers['x-github-event']||'unknown');const delivery=String(req.headers['x-github-delivery']||'');if(!delivery)return json(res,400,{error:'GitHub delivery ID is missing.'});if(!await registerWebhookDelivery(delivery,event))return json(res,202,{ok:true,duplicate:true});if(event!=='push')return json(res,202,{ok:true,ignored:true});
    const payload=JSON.parse(body.toString('utf8')) as {repository?:{full_name?:string}};const repository=payload.repository?.full_name;if(!repository)return json(res,400,{error:'Repository is missing.'});
    const quests=await acceptedQuestsForRepository(repository);for(const githubId of new Set(quests.map(quest=>quest.githubId))){const id=await createScan(githubId);await enqueueScan(id)}return json(res,202,{ok:true,scans:new Set(quests.map(quest=>quest.githubId)).size});
  }
  if (url.pathname === '/api/health') { const [database,queue,ollama]=await Promise.all([dbHealth(),queueHealth(),ollamaStatus()]); return json(res, database&&queue?200:503, { ok: database&&queue, database, queue, oauthConfigured: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET), ollama }); }
  if (url.pathname === '/api/auth/status') {
    const current = await session(req);
    return json(res, 200, { connected: Boolean(current), user: current?.user || null, oauthConfigured: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) });
  }
  const publicPassportMatch=url.pathname.match(/^\/api\/passports\/([A-Za-z0-9-]+)$/);
  if(publicPassportMatch&&req.method==='GET'){
    const row=await getPublicPassport(publicPassportMatch[1]);if(!row)return json(res,404,{error:'This Developer Passport is private or unavailable.'});
    const result=row.result as AnalysisResult;const passport:PublicPassport={public:true,profile:{...result.profile,xp:row.xp},scannedAt:result.scannedAt,skills:result.skills,repositories:result.repositories.map(repository=>({name:repository.name,url:repository.url,language:repository.language})),aiVerified:result.aiReview.used};return json(res,200,passport);
  }
  if (url.pathname === '/api/auth/github') {
    console.log(`[auth] GitHub authorization started at ${new Date().toISOString()}`);
    if (!process.env.GITHUB_CLIENT_ID) return redirect(res, '/?demo=1');
    const state = crypto.randomBytes(24).toString('hex'); await saveState(state);
    const params = new URLSearchParams({ client_id: process.env.GITHUB_CLIENT_ID, redirect_uri: `${appUrl(req)}/api/auth/callback`, scope: process.env.GITHUB_OAUTH_SCOPE || 'read:user', state });
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
  if(url.pathname==='/api/passport/settings'&&req.method==='GET'){const current=await session(req);if(!current)return json(res,401,{error:'Authentication required.'});return json(res,200,{...await getPassportSettings(current.githubId),login:current.user.login})}
  if(url.pathname==='/api/passport/settings'&&req.method==='PUT'){const current=await session(req);if(!current)return json(res,401,{error:'Authentication required.'});const body=await jsonBody<{isPublic?:unknown}>(req);if(typeof body.isPublic!=='boolean')return json(res,400,{error:'isPublic must be a boolean.'});return json(res,200,{...await setPassportPublic(current.githubId,body.isPublic),login:current.user.login})}
  if(url.pathname==='/api/career-target'&&req.method==='GET'){const current=await session(req);if(!current)return json(res,401,{error:'Authentication required.'});return json(res,200,await getCareerTarget(current.githubId))}
  if(url.pathname==='/api/career-target'&&req.method==='POST'){const current=await session(req);if(!current)return json(res,401,{error:'Authentication required.'});const body=await jsonBody<{role?:string;jobDescription?:string}>(req);if(!body.role?.trim()||body.role.length>100||Number(body.jobDescription?.length||0)>8000)return json(res,400,{error:'Enter a role (max 100 characters) and a job description under 8,000 characters.'});const scan=await getLatestScan(current.githubId);if(!scan?.result)return json(res,409,{error:'Complete a code scan before generating a career target.'});return json(res,201,await saveCareerTarget(current.githubId,generateCareerTarget(scan.result as AnalysisResult,body.role,body.jobDescription||'')))}
  if(url.pathname==='/api/quests/current'&&req.method==='GET'){const current=await session(req);if(!current)return json(res,401,{error:'Authentication required.'});return json(res,200,await getCurrentQuest(current.githubId))}
  if(url.pathname==='/api/quests/recommended'&&req.method==='GET'){const current=await session(req);if(!current)return json(res,401,{error:'Authentication required.'});const scan=await getLatestScan(current.githubId);if(!scan?.result)return json(res,409,{error:'Complete a code scan before generating a quest.'});return json(res,200,recommendQuest(scan.result as AnalysisResult))}
  if(url.pathname==='/api/quests/accept'&&req.method==='POST'){const current=await session(req);if(!current)return json(res,401,{error:'Authentication required.'});const existing=await getCurrentQuest(current.githubId);if(existing?.status==='accepted')return json(res,200,existing);const scan=await getLatestScan(current.githubId);if(!scan?.result)return json(res,409,{error:'Complete a code scan before accepting a quest.'});const quest=recommendQuest(scan.result as AnalysisResult);if(!quest.baselineSha)return json(res,409,{error:'Run a fresh Evidence V2 scan before accepting this quest.'});return json(res,201,await saveQuest(current.githubId,quest))}
  const scanMatch = url.pathname.match(/^\/api\/scans\/([0-9a-f-]+)$/);
  if (scanMatch && req.method === 'GET') { const current=await session(req); if(!current)return json(res,401,{error:'Authentication required.'}); const scan=await getScan(scanMatch[1],current.githubId); return scan?json(res,200,scan):json(res,404,{error:'Scan not found.'}); }
  return json(res, 404, { error: 'Not found' });
}
