import { reviewWithOllama, type AiRuntimeSettings } from './ollama.js';
import type { AnalysisResult, Evidence, Skill, SkillKey, ScanStage } from '../shared/types.js';

type SourceKind = Evidence['sourceKind'];
interface SourceFile { repo:string; path:string; content:string; url:string; commitSha?:string; pushedAt?:string }
interface SkillRule { title: string; base: RegExp; patterns: Array<[string, RegExp, number?]> }
interface GitHubUser { login:string; name?:string|null; avatar_url?:string; bio?:string|null }
interface GitHubRepo { name:string; full_name:string; html_url:string; language:string|null; pushed_at:string; default_branch:string; fork:boolean; archived:boolean; private:boolean }
interface GitTreeItem { type:string; size:number; path:string }
interface GitTree { tree:GitTreeItem[] }
interface GitCommit { sha:string }
const SKILL_RULES: Record<SkillKey, SkillRule> = {
  python: {
    title: 'PYTHON', base: /\.py$|(^|\/)(pyproject\.toml|setup\.py)$/i,
    patterns: [
      ['Async IO', /\basync\s+def\b[\s\S]{0,800}\bawait\b/, 1], ['Type System', /\b(Protocol|TypeVar|Generic)\b|:\s*(str|int|bool|list|dict)\b/, .75],
      ['Data Models', /@(dataclass)|class\s+\w+\s*\(\s*BaseModel\s*\)/, .9], ['Packaging', /(^|\/)(pyproject\.toml|setup\.py)$/i, .7], ['Testing', /\bpytest\.(mark|fixture)\b|\bunittest\.TestCase\b/, .75]
    ]
  },
  fastapi: {
    title: 'FASTAPI', base: /\.py$/i,
    patterns: [
      ['Async API', /@(app|router)\.(get|post|put|patch|delete)[\s\S]{0,400}async\s+def/, 1], ['Dependency Injection', /\bDepends\s*\([^)]+\)/, .85],
      ['Middleware', /\b(BaseHTTPMiddleware|add_middleware|@app\.middleware)\b/, .85], ['Authentication', /\b(OAuth2PasswordBearer|HTTPBearer|Security\s*\(|Depends\s*\(\s*(get_)?current_user)\b/i, .9],
      ['SSE', /\b(StreamingResponse|EventSourceResponse)\s*\(|media_type\s*=\s*["']text\/event-stream/, .9], ['Testing', /\b(TestClient|AsyncClient)\s*\([\s\S]{0,500}\b(test_|assert\b)/, .75]
    ]
  },
  api: {
    title: 'API DESIGN', base: /\.(py|ts|js|go|rs|java)$/i,
    patterns: [
      ['REST', /\b(router|app)\.(get|post|put|patch|delete)\s*\(|@(Get|Post|Put|Delete)Mapping\s*\(/, .85], ['Versioning', /\/api\/v\d|APIRouter\([^)]*prefix\s*=\s*["']\/v\d/, .8],
      ['Error Models', /\b(HTTPException|ProblemDetails|ExceptionFilter)\s*\(|@\w*exception_handler/, .8], ['Rate Limits', /\b(rateLimiter|rate_limit|throttle)\s*[.(]/i, .9], ['Streaming', /\b(StreamingResponse|EventSourceResponse|WebSocket)\s*\(/, .85]
    ]
  },
  llm: {
    title: 'LLM', base: /\.(py|ts|js)$/i,
    patterns: [['Providers', /\b(OpenAI|Anthropic|GoogleGenerativeAI)\s*\(|\bollama\.(chat|generate)\s*\(/i, .85], ['Prompting', /\b(system_prompt|prompt_template|messages)\s*=\s*[\[{`"']/i, .7], ['Streaming', /\bstream\s*=\s*(true|True)|\bstreaming\s*:\s*true/i, .75], ['Tool Calling', /\b(tool_calls?|function_call|bind_tools)\b[\s\S]{0,300}[\[(]/i, .9], ['Guardrails', /\b(guardrail|moderation|content_filter)\w*\s*[=(]/i, .9]]
  },
  testing: {
    title: 'TESTING', base: /(^|\/)(test|tests|spec|__tests__)(\/|_|\.)|\.(test|spec)\./i,
    patterns: [['Unit Tests', /\b(test|it|describe)\s*\(|\bdef\s+test_/, .85], ['Fixtures', /@pytest\.fixture|\bbeforeEach\s*\(|\bsetUp\s*\(/, .75], ['Mocking', /\b(mock|patch)\s*\(|\b(vi|jest)\.fn\s*\(/i, .8], ['Integration', /\b(TestClient|supertest)\s*\(|\bintegration\b[\s\S]{0,200}\b(test|describe)\s*\(/i, .9], ['Coverage', /--cov\b|coverageThreshold|\b(c8|istanbul)\s+/i, .65]]
  },
  database: {
    title: 'DATABASES', base: /\.(py|ts|js|sql|go)$/i,
    patterns: [['Schema', /\b(CREATE TABLE|Table\s*\(|class\s+\w+\(.*Base)/i], ['Migrations', /\b(alembic|migration|CREATE TABLE|ALTER TABLE)\b/i], ['Transactions', /\b(transaction|commit\s*\(|rollback\s*\()/i], ['Indexes', /\b(CREATE INDEX|Index\s*\()/i], ['PostgreSQL', /\b(postgres|psycopg|asyncpg)\b/i]]
  },
  rag: {
    title: 'RAG', base: /\.(py|ts|js)$/i,
    patterns: [['Chunking', /\b(split_documents|text_splitter\.split|chunk_size\s*=)\b/i, .8], ['Embeddings', /\b(embed_documents|embeddings?\.create|encode)\s*\(/i, .8], ['Vector Search', /\b(similarity_search|query_points|vector_store\.search)\s*\(|\b(Pinecone|QdrantClient|Chroma)\s*\(/i, .9], ['Reranking', /\b(rerank|cross_encoder)\w*\s*\(/i, .9], ['Evaluation', /\b(context_precision|faithfulness|ragas|retrieval_eval)\b/i, .95]]
  },
  agents: {
    title: 'AGENTS', base: /(^|\/)(agent|agents|workflow|workflows|graph)[^/]*\/|\.(agent|workflow)\.(py|ts|js)$/i,
    patterns: [['Tool Calling', /\b(tool_calls?|function_call|bind_tools)\b/i], ['Planning', /\b(planner|plan_step|next_action)\b/i], ['State', /\b(checkpoint|agent_state|state_graph|memory_saver)\b/i], ['Recovery', /\b(retry|fallback|recover)\b/i], ['Evaluation', /\b(agent.?eval|trajectory.?eval)\b/i]]
  },
  evaluation: {
    title: 'EVALUATION', base: /(^|\/)(eval|evals|evaluation|benchmarks?|golden)(\/|_|\.)/i,
    patterns: [['Datasets', /\b(eval_dataset|golden_dataset|test_cases)\b/i], ['Metrics', /\b(precision|recall|faithfulness|exact_match|pass_rate)\b/i], ['Regression', /\b(regression.?test|baseline.?score)\b/i], ['Tracing', /\b(langsmith|langfuse|opentelemetry|trace_id)\b/i]]
  }
};

const IGNORED = /(^|\/)(node_modules|dist|build|vendor|\.venv|coverage|fixtures?)(\/|$)/i;
const GENERATED = /(\.min\.(js|css)$|(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|generated|snapshots?)(\/|$))/i;
const MAX_REPOS = 8;
const MAX_FILES_PER_REPO = 24;

async function github<T>(path:string, token:string):Promise<T> {
  const response = await fetch(`https://api.github.com${path}`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'DEVTREE' } });
  if (!response.ok) throw new Error(`GitHub API ${response.status}: ${await response.text()}`);
  return response.json() as Promise<T>;
}

function candidateScore(path:string) {
  let score = 0;
  if (/(^|\/)(src|app|api|server|core|tests?|evals?)(\/|$)/i.test(path)) score += 3;
  if (/(route|auth|middleware|agent|retriev|rag|llm|model|schema|migration|test|eval)/i.test(path)) score += 4;
  if (/\.(py|ts|js|go|rs|java|sql|toml)$/i.test(path)) score += 2;
  return score;
}

function lineFor(content:string, regex:RegExp) {
  const match = content.match(regex);
  return match ? content.slice(0, match.index).split('\n').length : 1;
}

function snippetFor(content:string, regex:RegExp) {
  const match = content.match(regex);
  if (!match) return '';
  const index=match.index??0;
  const start = Math.max(0, index - 120);
  return content.slice(start, Math.min(content.length, index + match[0].length + 220)).replace(/\s+/g, ' ').trim();
}

function sourceKind(path: string): SourceKind {
  if (/(^|\/)(test|tests|spec|specs|__tests__)(\/|_|\.)|\.(test|spec)\./i.test(path)) return 'test';
  if (/(^|\/)(pyproject\.toml|package\.json|.*config\.(js|ts|json)|.*\.ya?ml|Dockerfile)$/i.test(path)) return 'config';
  return 'production';
}

function recencyWeight(pushedAt?: string): number {
  if (!pushedAt) return .85;
  const days = (Date.now() - new Date(pushedAt).getTime()) / 86_400_000;
  return days < 180 ? 1 : days < 730 ? .88 : .72;
}

function implementationDepth(snippet: string): number {
  if (/^\s*(import|from)\b/.test(snippet) && !/\b(def|class|function|=>|await|return)\b/.test(snippet)) return .42;
  if (/\b(def|class|function|async|await|return|raise|throw)\b|=>/.test(snippet)) return 1;
  return .72;
}

function evidenceStrength(file: SourceFile, snippet: string, patternWeight: number, skill: SkillKey): number {
  const kind = sourceKind(file.path);
  const kindWeight = kind === 'production' ? 1 : kind === 'config' ? .62 : (skill === 'testing' || skill === 'evaluation' ? 1 : .48);
  return Math.round(100 * kindWeight * patternWeight * implementationDepth(snippet) * recencyWeight(file.pushedAt));
}

export function scoreSkills(files: SourceFile[]): Record<SkillKey, Skill> {
  return Object.fromEntries(Object.entries(SKILL_RULES).map(([key, rule]) => {
    const hits: Evidence[] = [];
    const capabilities = rule.patterns.map(([name, regex, patternWeight=.8]) => {
      const candidates = files.filter(file => rule.base.test(file.path) && regex.test(`${file.path}\n${file.content}`)).map(file => {
        const snippet = snippetFor(`${file.path}\n${file.content}`, regex);
        return { file, snippet, strength: evidenceStrength(file, snippet, patternWeight, key as SkillKey) };
      }).filter(candidate => candidate.strength >= 32);
      const bestPerRepository = [...new Map(candidates.sort((a,b)=>b.strength-a.strength).map(candidate=>[candidate.file.repo,candidate])).values()];
      const capabilityScore = bestPerRepository.slice(0,3).reduce((sum,candidate)=>sum+candidate.strength,0);
      const state = capabilityScore >= 75 ? '✓' : capabilityScore >= 42 ? '△' : '✕';
      for (const {file,snippet,strength} of bestPerRepository.slice(0,2)) hits.push({ capability:name, repository:file.repo, path:file.path, line:lineFor(file.content,regex), summary:`${name} has ${strength >= 75 ? 'strong' : 'supporting'} implementation evidence in ${file.path}.`, url:file.url, strength, sourceKind:sourceKind(file.path), commitSha:file.commitSha, _snippet:snippet });
      return [state, name];
    });
    const verified = capabilities.filter(([state]) => state === '✓').length;
    const partial = capabilities.filter(([state]) => state === '△').length;
    const strongHits = hits.filter(hit=>hit.strength>=70);
    const repetition = new Set(strongHits.map(hit => hit.repository)).size;
    const evidenceScore = Math.min(100, verified*13 + partial*5 + Math.min(16,repetition*4) + Math.min(18,Math.round(strongHits.reduce((sum,hit)=>sum+hit.strength,0)/40)));
    const thresholds = [0,10,20,31,43,55,67,77,86,93,97];
    const level = verified === 0 && partial === 0 ? 0 : thresholds.reduce((current,threshold,index)=>evidenceScore>=threshold?index:current,0);
    const confidence = level === 0 ? 0 : Math.min(96, 38 + verified*8 + partial*3 + repetition*4);
    const missing = capabilities.filter(([state]) => state !== '✓').map(([, name]) => name);
    return [key, { title: rule.title, level, score: evidenceScore, confidence, capabilities, repositoryCount: repetition, evidenceScore, evidence: hits.sort((a,b)=>b.strength-a.strength).slice(0, 6), reason: verified ? `${repetition} independent repositories provide strong evidence for ${verified} of ${capabilities.length} tracked ${rule.title.toLowerCase()} capabilities.` : `No strong ${rule.title.toLowerCase()} implementation evidence was found; supporting signals remain unverified.`, next: missing.length ? `Add verifiable ${missing.slice(0, 2).join(' and ')} implementation evidence to progress toward Level ${Math.min(10, level + 1)}.` : `Demonstrate this skill across more independent production repositories to deepen confidence.` }];
  })) as Record<SkillKey, Skill>;
}

export async function analyzeGitHub(token: string, onProgress: (stage: ScanStage, progress: number) => Promise<void> = async () => {},aiSettings?:AiRuntimeSettings) : Promise<AnalysisResult> {
  await onProgress('repositories', 15);
  const [user, allRepos] = await Promise.all([github<GitHubUser>('/user', token), github<GitHubRepo[]>('/user/repos?per_page=50&sort=pushed&affiliation=owner,collaborator', token)]);
  const repos = allRepos.filter(repo => !repo.fork && !repo.archived).slice(0, MAX_REPOS);
  const files: SourceFile[] = [];
  const repoHeads = new Map<string,string>();
  for (const [repoIndex, repo] of repos.entries()) {
    try {
      const branch = encodeURIComponent(repo.default_branch);
      const [tree, commit] = await Promise.all([github<GitTree>(`/repos/${repo.full_name}/git/trees/${branch}?recursive=1`, token),github<GitCommit>(`/repos/${repo.full_name}/commits/${branch}`,token)]);
      repoHeads.set(repo.full_name,commit.sha);
      const candidates = tree.tree.filter(item => item.type === 'blob' && item.size < 100_000 && !IGNORED.test(item.path) && !GENERATED.test(item.path) && candidateScore(item.path) >= 2).sort((a, b) => candidateScore(b.path) - candidateScore(a.path)).slice(0, MAX_FILES_PER_REPO);
      for (const file of candidates) {
        try {
          const raw = await fetch(`https://raw.githubusercontent.com/${repo.full_name}/${repo.default_branch}/${file.path}`, { headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'DEVTREE' } });
          if (raw.ok) files.push({ repo: repo.full_name, path: file.path, content: (await raw.text()).slice(0, 120_000), url: `${repo.html_url}/blob/${commit.sha}/${file.path}`, commitSha:commit.sha, pushedAt:repo.pushed_at });
        } catch { /* A single unreadable file must not abort a scan. */ }
      }
    } catch { /* Empty or unusually large repositories can be skipped safely. */ }
    await onProgress('repositories', 15 + Math.round(((repoIndex + 1) / Math.max(1, repos.length)) * 40));
  }
  await onProgress('evidence', 62);
  const ruleSkills = scoreSkills(files);
  await onProgress('ai_review', 72);
  const reviewed = await reviewWithOllama(ruleSkills,aiSettings);
  await onProgress('scoring', 94);
  const skills = Object.fromEntries(Object.entries(reviewed.skills).map(([key, skill]) => [key, { ...skill, evidence: skill.evidence.map(({ _snippet, ...evidence }) => evidence) }])) as Record<SkillKey, Skill>;
  const overallLevel = Math.max(1, Math.round(Object.values(skills).reduce((sum, skill) => sum + skill.level, 0) / 2));
  return { profile: { login: user.login, name: user.name || user.login, avatarUrl: user.avatar_url, bio: user.bio, repositoryCount: repos.length, overallLevel }, scannedAt: new Date().toISOString(), filesInspected: files.length, repositories: repos.map(repo => ({ name: repo.name, fullName:repo.full_name, url: repo.html_url, language: repo.language, pushedAt: repo.pushed_at, defaultBranch:repo.default_branch, headSha:repoHeads.get(repo.full_name),private:repo.private })), skills, aiReview: reviewed.review } as AnalysisResult;
}
