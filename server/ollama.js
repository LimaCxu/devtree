const DEFAULT_URL = 'http://127.0.0.1:11434';
const DEFAULT_MODEL = 'qwen3.6:latest';

function config() {
  return {
    url: (process.env.OLLAMA_URL || DEFAULT_URL).replace(/\/$/, ''),
    model: process.env.OLLAMA_MODEL || DEFAULT_MODEL,
    enabled: process.env.OLLAMA_ENABLED !== 'false'
  };
}

export async function ollamaStatus() {
  const current = config();
  if (!current.enabled) return { available: false, model: current.model, reason: 'disabled' };
  try {
    const response = await fetch(`${current.url}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (!response.ok) return { available: false, model: current.model, reason: `HTTP ${response.status}` };
    const data = await response.json();
    const models = data.models?.map(item => item.name) || [];
    return { available: models.includes(current.model), model: current.model, models };
  } catch (error) {
    return { available: false, model: current.model, reason: error.message };
  }
}

const schema = {
  type: 'object',
  properties: {
    reviews: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          skill: { type: 'string' },
          recommendedLevel: { type: 'integer', minimum: 0, maximum: 10 },
          confidenceAdjustment: { type: 'integer', minimum: -15, maximum: 10 },
          explanation: { type: 'string' },
          missingEvidence: { type: 'array', items: { type: 'string' } }
        },
        required: ['skill', 'recommendedLevel', 'confidenceAdjustment', 'explanation', 'missingEvidence']
      }
    }
  },
  required: ['reviews']
};

function compactEvidence(skills) {
  return Object.entries(skills).map(([key, skill]) => ({
    skill: key,
    ruleLevel: skill.level,
    verifiedCapabilities: skill.capabilities.filter(([state]) => state === '✓').map(([, name]) => name),
    missingCapabilities: skill.capabilities.filter(([state]) => state !== '✓').map(([, name]) => name),
    evidence: skill.evidence.slice(0, 5).map(item => ({ repository: item.repository, path: item.path, line: item.line, capability: item.capability, code: item._snippet }))
  }));
}

export async function reviewWithOllama(skills) {
  const current = config();
  if (!current.enabled) return { skills, review: { used: false, reason: 'disabled', model: current.model } };
  const status = await ollamaStatus();
  if (!status.available) return { skills, review: { used: false, reason: status.reason || 'model unavailable', model: current.model } };

  const prompt = `You are DEVTREE's strict code-evidence reviewer. Review the evidence JSON below. A skill level is 0-10. Never infer a capability that is not visible in the supplied code. Never invent repositories, files, line numbers, or technologies. Boilerplate and isolated imports deserve low weight; repeated implementation across repositories deserves more weight. Keep the recommended level within 1 point of ruleLevel unless ruleLevel is 0, which must stay 0. Explanations must be one concise sentence and explicitly state what the code proves. Return only schema-valid JSON.\n\n${JSON.stringify(compactEvidence(skills))}`;
  try {
    const response = await fetch(`${current.url}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: AbortSignal.timeout(Number(process.env.OLLAMA_TIMEOUT_MS || 120000)),
      body: JSON.stringify({ model: current.model, stream: false, think: false, format: schema, options: { temperature: 0.1, num_ctx: 16384 }, messages: [{ role: 'user', content: prompt }] })
    });
    if (!response.ok) throw new Error(`Ollama HTTP ${response.status}: ${await response.text()}`);
    const body = await response.json();
    const parsed = JSON.parse(body.message?.content || '{}');
    const reviews = new Map((parsed.reviews || []).map(item => [item.skill, item]));
    const reviewed = Object.fromEntries(Object.entries(skills).map(([key, skill]) => {
      const item = reviews.get(key);
      if (!item || skill.level === 0) return [key, skill];
      const level = Math.max(skill.level - 1, Math.min(skill.level + 1, Number(item.recommendedLevel) || skill.level));
      const confidence = Math.max(1, Math.min(99, skill.confidence + Math.max(-15, Math.min(10, Number(item.confidenceAdjustment) || 0))));
      const missing = Array.isArray(item.missingEvidence) ? item.missingEvidence.filter(Boolean).slice(0, 2) : [];
      return [key, { ...skill, level, score: level * 10, confidence, reason: item.explanation || skill.reason, next: missing.length ? `Add verifiable ${missing.join(' and ')} evidence to progress toward Level ${Math.min(10, level + 1)}.` : skill.next }];
    }));
    return { skills: reviewed, review: { used: true, model: current.model, reviewedAt: new Date().toISOString() } };
  } catch (error) {
    return { skills, review: { used: false, reason: error.message, model: current.model } };
  }
}
