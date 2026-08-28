import { reviewWithOllama } from './ollama.js';

const SKILL_RULES = {
  python: {
    title: 'PYTHON', base: /\.py$/i,
    patterns: [
      ['Async IO', /\basync\s+def\b|\bawait\b/], ['Type System', /\bProtocol\b|\bTypeVar\b|:\s*(str|int|bool|list|dict)\b/],
      ['Data Models', /\b(BaseModel|dataclass)\b/], ['Packaging', /pyproject\.toml|setup\.py/i], ['Testing', /\bpytest\b|\bunittest\b/]
    ]
  },
  fastapi: {
    title: 'FASTAPI', base: /\.py$/i,
    patterns: [
      ['Async API', /@(app|router)\.(get|post|put|patch|delete)[\s\S]{0,400}async\s+def/], ['Dependency Injection', /\bDepends\s*\(/],
      ['Middleware', /\b(BaseHTTPMiddleware|add_middleware|middleware\s*\()/], ['Authentication', /\b(OAuth2|HTTPBearer|Authorization|current_user)\b/i],
      ['SSE', /\b(StreamingResponse|text\/event-stream|EventSourceResponse)\b/], ['Testing', /\b(TestClient|AsyncClient|pytest)\b/]
    ]
  },
  api: {
    title: 'API DESIGN', base: /\.(py|ts|js|go|rs|java)$/i,
    patterns: [
      ['REST', /\b(router|app)\.(get|post|put|patch|delete)\b|@(Get|Post|Put|Delete)Mapping/], ['Versioning', /\/api\/v\d|APIRouter\([^)]*prefix\s*=\s*["']\/v\d/],
      ['Error Models', /\b(HTTPException|ProblemDetails|error_handler|ExceptionFilter)\b/], ['Rate Limits', /\b(rate.?limit|throttl)/i], ['Streaming', /\b(stream|SSE|websocket)\b/i]
    ]
  },
  llm: {
    title: 'LLM', base: /\.(py|ts|js)$/i,
    patterns: [['Providers', /\b(openai|anthropic|gemini|ollama)\b/i], ['Prompting', /\b(system_prompt|prompt_template|messages\s*=)\b/i], ['Streaming', /\bstream\s*=\s*true|streaming/i], ['Tool Calling', /\b(tool_calls?|function_call)\b/i], ['Guardrails', /\b(guardrail|moderation|content_filter)\b/i]]
  },
  testing: {
    title: 'TESTING', base: /(^|\/)(test|tests|spec|__tests__)(\/|_|\.)|\.(test|spec)\./i,
    patterns: [['Unit Tests', /\b(test|it|describe)\s*\(|\bdef\s+test_/], ['Fixtures', /\bfixture\b|beforeEach|setUp\s*\(/], ['Mocking', /\b(mock|patch|vi\.fn|jest\.fn)\b/i], ['Integration', /\b(TestClient|supertest|integration)\b/i], ['Coverage', /\b(coverage|cov|istanbul|c8)\b/i]]
  },
  database: {
    title: 'DATABASES', base: /\.(py|ts|js|sql|go)$/i,
    patterns: [['Schema', /\b(CREATE TABLE|Table\s*\(|class\s+\w+\(.*Base)/i], ['Migrations', /\b(alembic|migration|CREATE TABLE|ALTER TABLE)\b/i], ['Transactions', /\b(transaction|commit\s*\(|rollback\s*\()/i], ['Indexes', /\b(CREATE INDEX|Index\s*\()/i], ['PostgreSQL', /\b(postgres|psycopg|asyncpg)\b/i]]
  },
  rag: {
    title: 'RAG', base: /\.(py|ts|js)$/i,
    patterns: [['Chunking', /\b(chunk|text_splitter)\b/i], ['Embeddings', /\b(embedding|embed_documents)\b/i], ['Vector Search', /\b(vector.?store|similarity_search|pinecone|weaviate|chroma|qdrant)\b/i], ['Reranking', /\b(rerank|cross.?encoder)\b/i], ['Evaluation', /\b(context_precision|faithfulness|ragas|retrieval.?eval)\b/i]]
  },
  agents: {
    title: 'AGENTS', base: /\.(py|ts|js)$/i,
    patterns: [['Tool Calling', /\b(tool_calls?|function_call|bind_tools)\b/i], ['Planning', /\b(planner|plan_step|next_action)\b/i], ['State', /\b(checkpoint|agent_state|state_graph|memory_saver)\b/i], ['Recovery', /\b(retry|fallback|recover)\b/i], ['Evaluation', /\b(agent.?eval|trajectory.?eval)\b/i]]
  },
  evaluation: {
    title: 'EVALUATION', base: /\.(py|ts|js|json|ya?ml)$/i,
    patterns: [['Datasets', /\b(eval_dataset|golden_dataset|test_cases)\b/i], ['Metrics', /\b(precision|recall|faithfulness|exact_match|pass_rate)\b/i], ['Regression', /\b(regression.?test|baseline.?score)\b/i], ['Tracing', /\b(langsmith|langfuse|opentelemetry|trace_id)\b/i]]
  }
};

const IGNORED = /(^|\/)(node_modules|dist|build|vendor|\.venv|coverage|fixtures?)(\/|$)/i;
const MAX_REPOS = 8;
const MAX_FILES_PER_REPO = 24;

async function github(path, token) {
  const response = await fetch(`https://api.github.com${path}`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'DEVTREE' } });
  if (!response.ok) throw new Error(`GitHub API ${response.status}: ${await response.text()}`);
  return response.json();
}

function candidateScore(path) {
  let score = 0;
  if (/(^|\/)(src|app|api|server|core|tests?|evals?)(\/|$)/i.test(path)) score += 3;
  if (/(route|auth|middleware|agent|retriev|rag|llm|model|schema|migration|test|eval)/i.test(path)) score += 4;
  if (/\.(py|ts|js|go|rs|java|sql|toml)$/i.test(path)) score += 2;
  return score;
}

function lineFor(content, regex) {
  const match = content.match(regex);
  return match ? content.slice(0, match.index).split('\n').length : 1;
}

function snippetFor(content, regex) {
  const match = content.match(regex);
  if (!match) return '';
  const start = Math.max(0, match.index - 120);
  return content.slice(start, Math.min(content.length, match.index + match[0].length + 220)).replace(/\s+/g, ' ').trim();
}

export function scoreSkills(files) {
  return Object.fromEntries(Object.entries(SKILL_RULES).map(([key, rule]) => {
    const hits = [];
    const capabilities = rule.patterns.map(([name, regex]) => {
      const matching = files.filter(file => (rule.base.test(file.path) || rule.base.test(file.content)) && regex.test(`${file.path}\n${file.content}`));
      for (const file of matching.slice(0, 2)) hits.push({ capability: name, repository: file.repo, path: file.path, line: lineFor(file.content, regex), summary: `${name} is implemented in ${file.path}.`, url: file.url, _snippet: snippetFor(file.content, regex) });
      return [matching.length ? '✓' : '✕', name];
    });
    const verified = capabilities.filter(([state]) => state === '✓').length;
    const repetition = new Set(hits.map(hit => hit.repo)).size;
    const level = verified === 0 ? 0 : Math.min(10, Math.max(1, verified + Math.min(3, repetition)));
    const confidence = verified === 0 ? 0 : Math.min(98, 58 + verified * 7 + repetition * 3);
    const missing = capabilities.filter(([state]) => state !== '✓').map(([, name]) => name);
    return [key, { title: rule.title, level, score: level * 10, confidence, capabilities, repositoryCount: repetition, evidence: hits.slice(0, 6), reason: verified ? `${repetition} repositories provide evidence for ${verified} of ${capabilities.length} tracked ${rule.title.toLowerCase()} capabilities.` : `No reliable ${rule.title.toLowerCase()} code signal was found in the repositories scanned.`, next: missing.length ? `Add verifiable ${missing.slice(0, 2).join(' and ')} evidence to progress toward Level ${Math.min(10, level + 1)}.` : `Demonstrate this skill across more production repositories to deepen confidence.` }];
  }));
}

export async function analyzeGitHub(token) {
  const [user, allRepos] = await Promise.all([github('/user', token), github('/user/repos?per_page=50&sort=pushed&affiliation=owner,collaborator', token)]);
  const repos = allRepos.filter(repo => !repo.fork && !repo.archived).slice(0, MAX_REPOS);
  const files = [];
  for (const repo of repos) {
    try {
      const branch = encodeURIComponent(repo.default_branch);
      const tree = await github(`/repos/${repo.full_name}/git/trees/${branch}?recursive=1`, token);
      const candidates = tree.tree.filter(item => item.type === 'blob' && item.size < 100_000 && !IGNORED.test(item.path) && candidateScore(item.path) >= 2).sort((a, b) => candidateScore(b.path) - candidateScore(a.path)).slice(0, MAX_FILES_PER_REPO);
      for (const file of candidates) {
        try {
          const raw = await fetch(`https://raw.githubusercontent.com/${repo.full_name}/${repo.default_branch}/${file.path}`, { headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'DEVTREE' } });
          if (raw.ok) files.push({ repo: repo.name, path: file.path, content: (await raw.text()).slice(0, 120_000), url: `${repo.html_url}/blob/${repo.default_branch}/${file.path}` });
        } catch { /* A single unreadable file must not abort a scan. */ }
      }
    } catch { /* Empty or unusually large repositories can be skipped safely. */ }
  }
  const ruleSkills = scoreSkills(files);
  const reviewed = await reviewWithOllama(ruleSkills);
  const skills = Object.fromEntries(Object.entries(reviewed.skills).map(([key, skill]) => [key, { ...skill, evidence: skill.evidence.map(({ _snippet, ...evidence }) => evidence) }]));
  const overallLevel = Math.max(1, Math.round(Object.values(skills).reduce((sum, skill) => sum + skill.level, 0) / 2));
  return { profile: { login: user.login, name: user.name || user.login, avatarUrl: user.avatar_url, bio: user.bio, repositoryCount: repos.length, overallLevel }, scannedAt: new Date().toISOString(), filesInspected: files.length, repositories: repos.map(repo => ({ name: repo.name, url: repo.html_url, language: repo.language, pushedAt: repo.pushed_at })), skills, aiReview: reviewed.review };
}
