import crypto from 'node:crypto';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
let ready;

export function initDb() {
  if (!ready) ready = pool.query(`
    CREATE TABLE IF NOT EXISTS oauth_states (state text PRIMARY KEY, expires_at timestamptz NOT NULL);
    CREATE TABLE IF NOT EXISTS users (github_id bigint PRIMARY KEY, login text NOT NULL, name text, avatar_url text, token_enc text NOT NULL, refresh_enc text, token_expires_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS sessions (id text PRIMARY KEY, github_id bigint NOT NULL REFERENCES users(github_id) ON DELETE CASCADE, expires_at timestamptz NOT NULL);
    CREATE TABLE IF NOT EXISTS scans (id uuid PRIMARY KEY, github_id bigint NOT NULL REFERENCES users(github_id) ON DELETE CASCADE, status text NOT NULL, stage text NOT NULL DEFAULT 'queued', progress integer NOT NULL DEFAULT 0, result jsonb, error text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS quests (id uuid PRIMARY KEY, github_id bigint NOT NULL REFERENCES users(github_id) ON DELETE CASCADE, skill_key text NOT NULL, title text NOT NULL, description text NOT NULL, repository_full_name text NOT NULL, baseline_sha text, reward_xp integer NOT NULL, status text NOT NULL DEFAULT 'accepted', objectives jsonb NOT NULL, accepted_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now());
    CREATE INDEX IF NOT EXISTS scans_user_created_idx ON scans(github_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS quests_user_status_idx ON quests(github_id, status, accepted_at DESC);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS refresh_enc text;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS token_expires_at timestamptz;
    ALTER TABLE scans ADD COLUMN IF NOT EXISTS stage text NOT NULL DEFAULT 'queued';
  `);
  return ready;
}

function key() { return crypto.createHash('sha256').update(process.env.TOKEN_ENCRYPTION_KEY || process.env.GITHUB_CLIENT_SECRET || 'dev-only-change-me').digest(); }
export function encrypt(value) { const iv = crypto.randomBytes(12); const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv); const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]); return [iv, cipher.getAuthTag(), data].map(item => item.toString('base64url')).join('.'); }
export function decrypt(value) { const [iv, tag, data] = value.split('.').map(item => Buffer.from(item, 'base64url')); const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv); decipher.setAuthTag(tag); return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8'); }

export async function saveState(state) { await initDb(); await pool.query('INSERT INTO oauth_states(state, expires_at) VALUES($1, now() + interval \'10 minutes\') ON CONFLICT(state) DO UPDATE SET expires_at=excluded.expires_at', [state]); }
export async function consumeState(state) { await initDb(); const result = await pool.query('DELETE FROM oauth_states WHERE state=$1 AND expires_at > now() RETURNING state', [state]); return result.rowCount === 1; }
export async function saveUser(user, tokenData) { await initDb(); const expiresAt=tokenData.expires_in?new Date(Date.now()+tokenData.expires_in*1000):null; await pool.query(`INSERT INTO users(github_id,login,name,avatar_url,token_enc,refresh_enc,token_expires_at) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(github_id) DO UPDATE SET login=excluded.login,name=excluded.name,avatar_url=excluded.avatar_url,token_enc=excluded.token_enc,refresh_enc=excluded.refresh_enc,token_expires_at=excluded.token_expires_at,updated_at=now()`, [user.id, user.login, user.name, user.avatar_url, encrypt(tokenData.access_token), tokenData.refresh_token?encrypt(tokenData.refresh_token):null, expiresAt]); }
export async function createSession(githubId) { await initDb(); const id = crypto.randomBytes(32).toString('hex'); await pool.query('INSERT INTO sessions(id,github_id,expires_at) VALUES($1,$2,now() + interval \'7 days\')', [id, githubId]); return id; }
async function usableToken(row) { if (!row.token_expires_at || new Date(row.token_expires_at).getTime()>Date.now()+300000) return decrypt(row.token_enc); if (!row.refresh_enc) throw new Error('GitHub access token expired; reconnect GitHub.'); const response=await fetch('https://github.com/login/oauth/access_token',{method:'POST',headers:{accept:'application/json','content-type':'application/json'},body:JSON.stringify({client_id:process.env.GITHUB_CLIENT_ID,client_secret:process.env.GITHUB_CLIENT_SECRET,grant_type:'refresh_token',refresh_token:decrypt(row.refresh_enc)})}); const data=await response.json(); if(!response.ok||!data.access_token)throw new Error('GitHub token refresh failed; reconnect GitHub.'); const expiresAt=data.expires_in?new Date(Date.now()+data.expires_in*1000):null; await pool.query('UPDATE users SET token_enc=$1,refresh_enc=$2,token_expires_at=$3,updated_at=now() WHERE github_id=$4',[encrypt(data.access_token),data.refresh_token?encrypt(data.refresh_token):row.refresh_enc,expiresAt,row.github_id]); return data.access_token; }
export async function getSession(id) { if (!id) return null; await initDb(); const { rows } = await pool.query(`SELECT s.github_id,u.login,u.name,u.avatar_url,u.token_enc,u.refresh_enc,u.token_expires_at FROM sessions s JOIN users u USING(github_id) WHERE s.id=$1 AND s.expires_at>now()`, [id]); if (!rows[0]) return null; return { githubId: rows[0].github_id, token: await usableToken(rows[0]), user: { login: rows[0].login, name: rows[0].name, avatarUrl: rows[0].avatar_url } }; }
export async function deleteSession(id) { await initDb(); await pool.query('DELETE FROM sessions WHERE id=$1', [id]); }
export async function createScan(githubId) { await initDb(); const id = crypto.randomUUID(); await pool.query('INSERT INTO scans(id,github_id,status,stage) VALUES($1,$2,$3,$4)', [id, githubId, 'queued', 'queued']); return id; }
const scanColumns = 'id,status,stage,progress,result,error,created_at AS "createdAt",updated_at AS "updatedAt"';
export async function getScan(id, githubId) { await initDb(); const { rows } = await pool.query(`SELECT ${scanColumns} FROM scans WHERE id=$1 AND github_id=$2`, [id, githubId]); return rows[0] || null; }
export async function getLatestScan(githubId) { await initDb(); const { rows } = await pool.query(`SELECT ${scanColumns} FROM scans WHERE github_id=$1 ORDER BY created_at DESC LIMIT 1`, [githubId]); return rows[0] || null; }
export async function updateScan(id, patch) { await initDb(); const fields=[]; const values=[]; for (const [name,value] of Object.entries(patch)) { values.push(value); fields.push(`${name}=$${values.length}`); } values.push(id); await pool.query(`UPDATE scans SET ${fields.join(',')},updated_at=now() WHERE id=$${values.length}`, values); }
export async function scanToken(id) { await initDb(); const { rows } = await pool.query('SELECT u.github_id,u.token_enc,u.refresh_enc,u.token_expires_at FROM scans s JOIN users u USING(github_id) WHERE s.id=$1', [id]); return rows[0] ? usableToken(rows[0]) : null; }
export async function scanOwner(id) { await initDb(); const {rows}=await pool.query('SELECT github_id FROM scans WHERE id=$1',[id]); return rows[0]?.github_id||null; }
const questColumns='id,skill_key AS "skillKey",title,description,repository_full_name AS "repositoryFullName",baseline_sha AS "baselineSha",reward_xp AS "rewardXp",status,objectives,accepted_at AS "acceptedAt",completed_at AS "completedAt"';
export async function getCurrentQuest(githubId) { await initDb(); const {rows}=await pool.query(`SELECT ${questColumns} FROM quests WHERE github_id=$1 ORDER BY (status='accepted') DESC,accepted_at DESC LIMIT 1`,[githubId]); return rows[0]||null; }
export async function saveQuest(githubId,quest) { await initDb(); const id=crypto.randomUUID(); const {rows}=await pool.query(`INSERT INTO quests(id,github_id,skill_key,title,description,repository_full_name,baseline_sha,reward_xp,status,objectives) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'accepted',$9) RETURNING ${questColumns}`,[id,githubId,quest.skillKey,quest.title,quest.description,quest.repositoryFullName,quest.baselineSha,quest.rewardXp,JSON.stringify(quest.objectives)]); return rows[0]; }
export async function updateQuestObjectives(id,githubId,objectives) { await initDb(); const {rows}=await pool.query(`UPDATE quests SET objectives=$1,updated_at=now() WHERE id=$2 AND github_id=$3 RETURNING ${questColumns}`,[JSON.stringify(objectives),id,githubId]); return rows[0]||null; }
export async function acceptedQuestsForRepository(repositoryFullName) { await initDb(); const {rows}=await pool.query(`SELECT github_id AS "githubId",${questColumns} FROM quests WHERE repository_full_name=$1 AND status='accepted'`,[repositoryFullName]); return rows; }
export async function acceptedQuestsForUser(githubId) { await initDb(); const {rows}=await pool.query(`SELECT ${questColumns} FROM quests WHERE github_id=$1 AND status='accepted'`,[githubId]); return rows; }
export async function completeQuest(id,objectives) { await initDb(); await pool.query(`UPDATE quests SET objectives=$1,status='completed',completed_at=now(),updated_at=now() WHERE id=$2`,[JSON.stringify(objectives),id]); }
export async function githubIdForLogin(login) { await initDb(); const {rows}=await pool.query('SELECT github_id FROM users WHERE lower(login)=lower($1)',[login]); return rows[0]?.github_id||null; }
export async function dbHealth() { try { await initDb(); await pool.query('SELECT 1'); return true; } catch { return false; } }
