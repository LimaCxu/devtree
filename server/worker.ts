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
    await updateScan(id, { status: 'running', stage: 'repositories', progress: 10, error: null });
    const token = await scanToken(id);
    if (!token) throw new Error('GitHub token is unavailable');
    const result = await analyzeGitHub(token, (stage, progress) => updateScan(id, { status: 'running', stage, progress }));
    await updateScan(id, { status: 'completed', stage: 'completed', progress: 100, result });
  } catch (error) {
    console.error(`[worker] scan ${id} failed:`, error.message);
    await updateScan(id, { status: 'failed', stage: 'failed', error: error instanceof Error ? error.message : 'Unknown scan failure' });
  }
}
