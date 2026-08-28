import { analyzeGitHub } from './analyzer.js';
import { initDb, scanToken, updateScan } from './db.js';
import { redis } from './queue.js';

await initDb();
console.log('[worker] scan worker ready');
while (true) {
  const item = await (await redis()).brPop('devtree:scans', 0);
  const id = item?.element;
  if (!id) continue;
  try {
    await updateScan(id, { status: 'running', progress: 10 });
    const token = await scanToken(id);
    if (!token) throw new Error('GitHub token is unavailable');
    const result = await analyzeGitHub(token);
    await updateScan(id, { status: 'completed', progress: 100, result });
  } catch (error) {
    console.error(`[worker] scan ${id} failed:`, error.message);
    await updateScan(id, { status: 'failed', error: error.message });
  }
}
