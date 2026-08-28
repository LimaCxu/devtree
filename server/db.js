import crypto from 'node:crypto';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
let ready;

export function initDb() {
  if (!ready) ready = pool.query(`
    CREATE TABLE IF NOT EXISTS oauth_states (state text PRIMARY KEY, expires_at timestamptz NOT NULL);
    CREATE TABLE IF NOT EXISTS users (github_id bigint PRIMARY KEY, login text NOT NULL, name text, avatar_url text, token_enc text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS sessions (id text PRIMARY KEY, github_id bigint NOT NULL REFERENCES users(github_id) ON DELETE CASCADE, expires_at timestamptz NOT NULL);
    CREATE TABLE IF NOT EXISTS scans (id uuid PRIMARY KEY, github_id bigint NOT NULL REFERENCES users(github_id) ON DELETE CASCADE, status text NOT NULL, progress integer NOT NULL DEFAULT 0, result jsonb, error text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
    CREATE INDEX IF NOT EXISTS scans_user_created_idx ON scans(github_id, created_at DESC);
  `);
  return ready;
}

function key() { return crypto.createHash('sha256').update(process.env.TOKEN_ENCRYPTION_KEY || process.env.GITHUB_CLIENT_SECRET || 'dev-only-change-me').digest(); }
export function encrypt(value) { const iv = crypto.randomBytes(12); const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv); const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]); return [iv, cipher.getAuthTag(), data].map(item => item.toString('base64url')).join('.'); }
export function decrypt(value) { const [iv, tag, data] = value.split('.').map(item => Buffer.from(item, 'base64url')); const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv); decipher.setAuthTag(tag); return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8'); }

export async function saveState(state) { await initDb(); await pool.query('INSERT INTO oauth_states(state, expires_at) VALUES($1, now() + interval \'10 minutes\') ON CONFLICT(state) DO UPDATE SET expires_at=excluded.expires_at', [state]); }
export async function consumeState(state) { await initDb(); const result = await pool.query('DELETE FROM oauth_states WHERE state=$1 AND expires_at > now() RETURNING state', [state]); return result.rowCount === 1; }
export async function saveUser(user, token) { await initDb(); await pool.query(`INSERT INTO users(github_id,login,name,avatar_url,token_enc) VALUES($1,$2,$3,$4,$5) ON CONFLICT(github_id) DO UPDATE SET login=excluded.login,name=excluded.name,avatar_url=excluded.avatar_url,token_enc=excluded.token_enc,updated_at=now()`, [user.id, user.login, user.name, user.avatar_url, encrypt(token)]); }
export async function createSession(githubId) { await initDb(); const id = crypto.randomBytes(32).toString('hex'); await pool.query('INSERT INTO sessions(id,github_id,expires_at) VALUES($1,$2,now() + interval \'7 days\')', [id, githubId]); return id; }
export async function getSession(id) { if (!id) return null; await initDb(); const { rows } = await pool.query(`SELECT s.github_id,u.login,u.name,u.avatar_url,u.token_enc FROM sessions s JOIN users u USING(github_id) WHERE s.id=$1 AND s.expires_at>now()`, [id]); if (!rows[0]) return null; return { githubId: rows[0].github_id, token: decrypt(rows[0].token_enc), user: { login: rows[0].login, name: rows[0].name, avatarUrl: rows[0].avatar_url } }; }
export async function deleteSession(id) { await initDb(); await pool.query('DELETE FROM sessions WHERE id=$1', [id]); }
export async function createScan(githubId) { await initDb(); const id = crypto.randomUUID(); await pool.query('INSERT INTO scans(id,github_id,status) VALUES($1,$2,$3)', [id, githubId, 'queued']); return id; }
export async function getScan(id, githubId) { await initDb(); const { rows } = await pool.query('SELECT id,status,progress,result,error,created_at,updated_at FROM scans WHERE id=$1 AND github_id=$2', [id, githubId]); return rows[0] || null; }
export async function updateScan(id, patch) { await initDb(); const fields=[]; const values=[]; for (const [name,value] of Object.entries(patch)) { values.push(value); fields.push(`${name}=$${values.length}`); } values.push(id); await pool.query(`UPDATE scans SET ${fields.join(',')},updated_at=now() WHERE id=$${values.length}`, values); }
export async function scanToken(id) { await initDb(); const { rows } = await pool.query('SELECT u.token_enc FROM scans s JOIN users u USING(github_id) WHERE s.id=$1', [id]); return rows[0] ? decrypt(rows[0].token_enc) : null; }
export async function dbHealth() { try { await initDb(); await pool.query('SELECT 1'); return true; } catch { return false; } }
