import { reviewWithOllama } from '../server/ollama.js';

const skills = {
  fastapi: {
    title: 'FASTAPI', level: 4, score: 40, confidence: 82,
    capabilities: [['✓', 'Async API'], ['✓', 'Dependency Injection'], ['✕', 'Testing']],
    evidence: [{ capability: 'Async API', repository: 'example', path: 'api.py', line: 4, _snippet: '@router.get("/items") async def items(user = Depends(current_user)): return []' }],
    reason: 'Rule-generated explanation.', next: 'Add testing evidence.'
  },
  evaluation: {
    title: 'EVALUATION', level: 0, score: 0, confidence: 0,
    capabilities: [['✕', 'Datasets']], evidence: [], reason: 'No signal.', next: 'Add evidence.'
  }
};

const result = await reviewWithOllama(skills);
console.log(JSON.stringify(result, null, 2));
if (!result.review.used) process.exitCode = 1;
if (result.skills.evaluation.level !== 0) process.exitCode = 1;
