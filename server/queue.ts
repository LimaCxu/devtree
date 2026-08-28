import { createClient } from 'redis';
let client;
export async function redis() { if (!client) { client=createClient({url:process.env.REDIS_URL}); client.on('error',error=>console.error('[redis]',error.message)); await client.connect(); } return client; }
export async function enqueueScan(id) { await (await redis()).lPush('devtree:scans', id); }
export async function queueHealth() { try { return await (await redis()).ping() === 'PONG'; } catch { return false; } }
