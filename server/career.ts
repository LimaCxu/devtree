import type { AnalysisResult, CareerGap, CareerTarget, RoadmapItem, SkillKey } from '../shared/types.js';

const baseTargets: Record<SkillKey, number> = {
  python: 85, fastapi: 65, api: 78, llm: 88, testing: 72,
  database: 62, rag: 82, agents: 76, evaluation: 78
};

const evidenceOutcomes: Record<SkillKey, [string, string]> = {
  python: ['Ship a typed async Python service', 'Typed models, async I/O and packaging in production code'],
  fastapi: ['Harden a production FastAPI boundary', 'Dependency injection, middleware and integration tests'],
  api: ['Design a versioned API contract', 'Structured errors, versioning and rate limits'],
  llm: ['Build a reliable model integration', 'Streaming, provider abstraction and guardrails'],
  testing: ['Create a service safety net', 'Integration tests, deterministic mocks and coverage'],
  database: ['Prove data-layer reliability', 'Migrations, indexes and transaction boundaries'],
  rag: ['Measure a retrieval pipeline', 'Chunking, reranking and retrieval evaluation'],
  agents: ['Build a recoverable agent workflow', 'Tool calls, durable state and replay'],
  evaluation: ['Ship a versioned evaluation suite', 'Datasets, metrics and regression gates']
};

function roleTargets(role: string, jobDescription = ''): Record<SkillKey, number> {
  const target = { ...baseTargets };
  const text = `${role} ${jobDescription}`.toLowerCase();
  if (/backend|后端|api/.test(text)) Object.assign(target, { fastapi: 84, api: 88, database: 80, testing: 82 });
  if (/rag|retrieval|检索/.test(text)) Object.assign(target, { rag: 92, evaluation: 84, database: 74 });
  if (/agent|智能体/.test(text)) Object.assign(target, { agents: 92, evaluation: 86, llm: 90 });
  if (/platform|mlops|平台|infra/.test(text)) Object.assign(target, { testing: 88, api: 84, evaluation: 86 });
  if (/senior|staff|lead|高级|资深|负责人/.test(text)) for (const key of Object.keys(target) as SkillKey[]) target[key] = Math.min(96, target[key] + 6);
  return target;
}

export function generateCareerTarget(result: AnalysisResult, role: string, jobDescription = ''): CareerTarget {
  const targets = roleTargets(role, jobDescription);
  const gaps: CareerGap[] = (Object.keys(targets) as SkillKey[]).map(skillKey => {
    const skill = result.skills[skillKey];
    const current = skill.evidenceScore ?? skill.score;
    const target = targets[skillKey];
    return { skillKey, title: skill.title, current, target, gap: Math.max(0, target - current) };
  }).sort((a, b) => b.gap - a.gap);
  const weights = gaps.reduce((sum, item) => sum + item.target, 0);
  const readiness = Math.round(gaps.reduce((sum, item) => sum + Math.min(item.current, item.target), 0) / weights * 100);
  const roadmap: RoadmapItem[] = gaps.slice(0, 3).map((gap, index) => {
    const [outcome, evidence] = evidenceOutcomes[gap.skillKey];
    return { weeks: (['1–4', '5–8', '9–12'] as const)[index], skillKey: gap.skillKey, title: outcome, outcome: `Close the ${gap.title} evidence gap from ${gap.current}% toward ${gap.target}%.`, evidence };
  });
  return { role: role.trim() || 'AI Engineer', jobDescription: jobDescription.trim() || undefined, readiness, gaps, roadmap };
}
