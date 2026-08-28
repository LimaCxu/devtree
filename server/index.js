import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApiRequest } from './api.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };

http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith('/api/')) return await handleApiRequest(req, res);
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const requested = pathname === '/' ? 'index.html' : pathname.slice(1);
    const safePath = path.resolve(dist, requested);
    const file = safePath.startsWith(dist) ? safePath : path.join(dist, 'index.html');
    try { const body = await fs.readFile(file); res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' }); res.end(body); }
    catch { const body = await fs.readFile(path.join(dist, 'index.html')); res.writeHead(200, { 'content-type': types['.html'] }); res.end(body); }
  } catch (error) { res.writeHead(500, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: error.message })); }
}).listen(Number(process.env.PORT || 4173), () => console.log(`DEVTREE running at http://localhost:${process.env.PORT || 4173}`));
