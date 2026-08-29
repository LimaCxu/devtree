import type { Skill, SkillKey } from '../shared/types.js';

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
          confidenceAdjustment: { type: 'integer', minimum: -20, maximum: 0 },
          explanation: { type: 'string' },
          missingEvidence: { type: 'array', items: { type: 'string' } }
        },
        required: ['skill', 'recommendedLevel', 'confidenceAdjustment', 'explanation', 'missingEvidence']
      }
    }
  },
  required: ['reviews']
};

function compactEvidence(skills: Record<SkillKey, Skill>) {
  return Object.entries(skills).map(([key, skill]) => ({
    skill: key,
    ruleLevel: skill.level,
    verifiedCapabilities: skill.capabilities.filter(([state]) => state === '✓').map(([, name]) => name),
    missingCapabilities: skill.capabilities.filter(([state]) => state !== '✓').map(([, name]) => name),
    evidence: skill.evidence.slice(0, 5).map(item => ({ repository: item.repository, path: item.path, line: item.line, capability: item.capability, strength: item.strength, sourceKind:item.sourceKind, code: item._snippet }))
  }));
}

interface ReviewItem { skill: SkillKey; recommendedLevel: number; confidenceAdjustment: number; explanation: string; missingEvidence: string[] }
export async function reviewWithOllama(skills: Record<SkillKey, Skill>): Promise<{skills:Record<SkillKey,Skill>;review:{used:boolean;model:string;reason?:string;reviewedAt?:string}}> {
  const current = config();
  if (!current.enabled) return { skills, review: { used: false, reason: 'disabled', model: current.model } };
  const status = await ollamaStatus();
  if (!status.available) return { skills, review: { used: false, reason: status.reason || 'model unavailable', model: current.model } };

  const prompt = `You are DEVTREE's adversarial code-evidence reviewer. The deterministic engine has proposed a maximum skill level. You may confirm or lower that level, never raise it. Never infer a capability that is not visible in the supplied code and never invent repositories, files, line numbers, or technologies. Imports, configuration mentions, boilerplate, tests of mocks, and repeated matches in one repository are not production mastery. Recommend a level from 0 through ruleLevel. confidenceAdjustment must be between -20 and 0. Explanations must be one concise sentence stating exactly what the supplied implementation proves. Return only schema-valid JSON.\n\n${JSON.stringify(compactEvidence(skills))}`;
  try {
    const response = await fetch(`${current.url}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: AbortSignal.timeout(Number(process.env.OLLAMA_TIMEOUT_MS || 120000)),
      body: JSON.stringify({ model: current.model, stream: false, think: false, format: schema, options: { temperature: 0.1, num_ctx: 16384 }, messages: [{ role: 'user', content: prompt }] })
    });
    if (!response.ok) throw new Error(`Ollama HTTP ${response.status}: ${await response.text()}`);
    const body = await response.json();
    const parsed = JSON.parse(body.message?.content || '{}') as { reviews?: ReviewItem[] };
    const reviews = new Map<SkillKey, ReviewItem>((parsed.reviews || []).map(item => [item.skill, item]));
    const reviewed = Object.fromEntries(Object.entries(skills).map(([key, skill]) => {
      const item = reviews.get(key as SkillKey);
      if (!item || skill.level === 0) return [key, skill];
      const recommendation = Number.isFinite(Number(item.recommendedLevel)) ? Number(item.recommendedLevel) : skill.level;
      const level = Math.max(0, Math.min(skill.level, recommendation));
      const confidence = Math.max(1, Math.min(skill.confidence, skill.confidence + Math.max(-20, Math.min(0, Number(item.confidenceAdjustment) || 0))));
      const missing = Array.isArray(item.missingEvidence) ? item.missingEvidence.filter(Boolean).slice(0, 2) : [];
      return [key, { ...skill, level, confidence, reason: item.explanation || skill.reason, next: missing.length ? `Add verifiable ${missing.join(' and ')} evidence to progress toward Level ${Math.min(10, level + 1)}.` : skill.next }];
    })) as Record<SkillKey, Skill>;
    return { skills: reviewed, review: { used: true, model: current.model, reviewedAt: new Date().toISOString() } };
  } catch (error) {
    return { skills, review: { used: false, reason: error.message, model: current.model } };
  }
}
