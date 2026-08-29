export type Locale = 'en' | 'zh';

const messages = {
  en: {
    'nav.profile': 'Open profile', 'nav.language': 'Switch to Chinese',
    'status.demo': 'DEMO INDEX', 'status.ready': 'READY',
    'hero.eyebrow': 'DEVELOPER PASSPORT / VERIFIED BY CODE', 'hero.line1': 'Your code becomes', 'hero.line2': 'your skill tree.',
    'hero.lede1': 'No self-reported skills. No vanity metrics.', 'hero.lede2': 'Every level is verified by the code you ship.',
    'action.connect': 'CONNECT GITHUB', 'action.scan': 'SCAN MY CODE', 'action.rescan': 'RESCAN CODE', 'action.scoring': 'HOW SCORING WORKS', 'action.disconnect': 'DISCONNECT',
    'connection.checking.title': 'Checking local services…', 'connection.checking.detail': 'Reading your GitHub connection and latest scan.',
    'connection.connected.title': 'Connected as @{login}', 'connection.connected.detail': 'Scans run locally; GitHub tokens are encrypted at rest.',
    'connection.disconnected.title': 'GitHub is not connected', 'connection.disconnected.detail': 'Authorize read access to build a verified skill graph.',
    'connection.offline.title': 'Local API is offline', 'connection.offline.detail': 'Run docker compose up --build -d, then retry.',
    'connection.oauth.title': 'GitHub OAuth is not configured', 'connection.oauth.detail': 'Add the client ID and secret to .env, then restart Docker.',
    'passport.verified': 'VERIFIED DEVELOPER', 'passport.role': 'AI BACKEND ENGINEER', 'passport.top': 'TOP SKILL', 'passport.repositories': 'REPOSITORIES', 'passport.seal': 'VERIFIED BY CODE',
    'passport.publish': 'PUBLISH PASSPORT', 'passport.unpublish': 'MAKE PRIVATE', 'passport.copy': 'COPY LINK', 'passport.publicView': 'PUBLIC PASSPORT',
    'tree.eyebrow': 'SKILL GRAPH / LIVE', 'tree.title': 'What your code proves.', 'tree.verified': 'VERIFIED', 'tree.emerging': 'EMERGING', 'tree.unknown': 'UNDISCOVERED',
    'tree.all': 'ALL DOMAINS', 'tree.backend': 'BACKEND', 'tree.ai': 'AI ENGINEERING', 'tree.hint': 'SELECT A NODE TO INSPECT ITS CODE EVIDENCE',
    'quest.unlocked': 'NEW QUEST UNLOCKED', 'quest.eyebrow': 'GROWTH OPPORTUNITY / TESTING', 'quest.title': 'The Testing Dungeon',
    'quest.description': "Your FastAPI foundations are strong. Your test coverage isn't. Add a reliable safety net to DustGuard.",
    'quest.generatedDescription': 'Strengthen {skill} with code evidence that can be verified after your next push.',
    'quest.name.python':'The Python Forge','quest.name.fastapi':'The API Citadel','quest.name.api':'The Contract Trial','quest.name.llm':'The Model Workshop','quest.name.testing':'The Testing Dungeon','quest.name.database':'The Data Vault','quest.name.rag':'The Retrieval Labyrinth','quest.name.agents':'The Agent Arena','quest.name.evaluation':'The Evaluation Gauntlet',
    'quest.pytest': 'Configure pytest', 'quest.integration': 'Add API integration tests', 'quest.mock': 'Mock LLM responses', 'quest.coverage': 'Reach 80% module coverage',
    'quest.reward': 'ESTIMATED REWARD', 'quest.accept': 'ACCEPT QUEST', 'quest.active': 'QUEST ACTIVE', 'quest.completed': 'QUEST COMPLETED', 'quest.note': 'Final reward depends on code verification.', 'quest.repository': 'Target repository: {repository}', 'quest.freshScan': 'Run a fresh Evidence V2 scan to establish the quest baseline.',
    'boss.eyebrow': 'CAREER BOSS / TARGET ROLE', 'boss.title': 'AI Engineer', 'boss.description': "You're 63% ready. Close the evidence gaps that matter most.", 'boss.generate': 'GENERATE QUEST LINE',
    'boss.skill': 'SKILL', 'boss.you': 'YOU', 'boss.target': 'TARGET', 'boss.rolePlaceholder': 'Target role: AI Engineer', 'boss.jdPlaceholder': 'Paste a job description (optional)',
    'boss.readiness': "You're {readiness}% ready. Close the evidence gaps that matter most.", 'boss.weeks': 'WEEKS {weeks}', 'boss.evidence': 'CODE EVIDENCE', 'boss.closeGap': 'Raise {skill} from {current}% toward {target}%.', 'boss.proveSkill': 'Ship inspectable {skill} implementation and tests.',
    'footer.slogan': 'SKILLS ARE CLAIMS. CODE IS EVIDENCE.',
    'drawer.eyebrow': 'VERIFIED SKILL / CODE EVIDENCE', 'drawer.updated': 'LATEST VERIFIED SCAN', 'drawer.level': 'LEVEL', 'drawer.confidence': 'AI CONFIDENCE',
    'drawer.why': 'Why am I Level {level}?', 'drawer.evidence': 'Code evidence', 'drawer.signals': '{count} SIGNALS', 'drawer.next': 'NEXT LEVEL', 'drawer.empty': 'No inspectable evidence found in the indexed repositories.',
    'modal.eyebrow': 'SCORING PROTOCOL', 'modal.title': 'Levels are earned, never selected.',
    'modal.description': 'DEVTREE reads implementation patterns across your repositories, weighs complexity and repetition, then links every conclusion to inspectable code. Missing GitHub evidence is shown as unknown—not incompetence.',
    'modal.step1': 'Code is indexed without storing secrets.', 'modal.step2': 'Capabilities are extracted with file-level citations.', 'modal.step3': 'Evidence is scored for depth, repetition and recency.',
    'scan.eyebrow': 'REPOSITORY SCAN / LIVE', 'scan.preparing': 'Preparing your scan…', 'scan.preparing.detail': 'The worker will report each verified stage.',
    'scan.repositories': 'Repositories', 'scan.evidence': 'Code evidence', 'scan.ai': 'Local AI review', 'scan.graph': 'Skill graph', 'scan.retry': 'RETRY SCAN', 'scan.close': 'CLOSE',
    'scan.queued.title': 'Scan queued', 'scan.queued.detail': 'Waiting for the local analysis worker.',
    'scan.repositories.title': 'Reading repositories', 'scan.repositories.detail': 'Selecting relevant source files from your active projects.',
    'scan.evidence.title': 'Finding code evidence', 'scan.evidence.detail': 'Matching implemented patterns to verifiable capabilities.',
    'scan.ai_review.title': 'Local AI review', 'scan.ai_review.detail': 'Ollama is challenging the rule-based score against real snippets.',
    'scan.scoring.title': 'Building your skill graph', 'scan.scoring.detail': 'Combining independent evidence, depth and recency into verified levels.',
    'scan.completed.title': 'Skill graph ready', 'scan.completed.detail': 'Every visible level now links back to code evidence.',
    'scan.failed.title': 'Scan stopped', 'scan.failed.detail': 'The current stage could not be completed.',
    'toast.offline': 'Local API is offline', 'toast.oauth': 'GitHub OAuth credentials are missing', 'toast.authExpired': 'GitHub authorization expired — try again', 'toast.authFailed': 'GitHub authorization failed — try again',
    'toast.quest': 'Quest accepted — check your repository', 'toast.questCompleted': 'Quest completed — XP verified and awarded', 'toast.roadmap': 'Your 12-week quest line is ready', 'toast.passport': 'Developer Passport — verified from your GitHub code', 'toast.published': 'Public Passport published', 'toast.private': 'Passport is private', 'toast.copied': 'Public Passport link copied',
    'count.nodes': '{verified} / {total} NODES DISCOVERED', 'count.evidence': '{count} EVIDENCE', 'count.none': 'NO SIGNAL', 'count.repositories': '{count} VERIFIED', 'scan.verified': '{count} files verified{model}'
  },
  zh: {
    'nav.profile': '打开开发者护照', 'nav.language': '切换为英文',
    'status.demo': '演示数据', 'status.ready': '已就绪',
    'hero.eyebrow': '开发者护照 / 代码验证', 'hero.line1': '你的代码，构成', 'hero.line2': '你的技能树。',
    'hero.lede1': '不靠自我描述，不看虚荣指标。', 'hero.lede2': '每一级能力，都由你提交的代码验证。',
    'action.connect': '连接 GITHUB', 'action.scan': '扫描我的代码', 'action.rescan': '重新扫描代码', 'action.scoring': '评分规则', 'action.disconnect': '断开连接',
    'connection.checking.title': '正在检查本地服务…', 'connection.checking.detail': '正在读取 GitHub 连接状态和最近一次扫描。',
    'connection.connected.title': '已连接 @{login}', 'connection.connected.detail': '扫描在本地运行；GitHub Token 加密存储。',
    'connection.disconnected.title': '尚未连接 GitHub', 'connection.disconnected.detail': '授权只读访问后，即可生成代码验证的技能图谱。',
    'connection.offline.title': '本地 API 未运行', 'connection.offline.detail': '运行 docker compose up --build -d 后重试。',
    'connection.oauth.title': '尚未配置 GitHub OAuth', 'connection.oauth.detail': '在 .env 中添加 Client ID 和 Secret，然后重启 Docker。',
    'passport.verified': '已验证开发者', 'passport.role': 'AI 后端工程师', 'passport.top': '最强技能', 'passport.repositories': '代码仓库', 'passport.seal': '代码已验证',
    'passport.publish': '发布开发者护照', 'passport.unpublish': '设为私密', 'passport.copy': '复制链接', 'passport.publicView': '公开开发者护照',
    'tree.eyebrow': '技能图谱 / 实时', 'tree.title': '你的代码证明了什么。', 'tree.verified': '已验证', 'tree.emerging': '成长中', 'tree.unknown': '尚未发现',
    'tree.all': '全部领域', 'tree.backend': '后端工程', 'tree.ai': 'AI 工程', 'tree.hint': '选择技能节点，查看具体代码证据',
    'quest.unlocked': '新任务已解锁', 'quest.eyebrow': '成长机会 / 测试能力', 'quest.title': '测试地牢',
    'quest.description': '你的 FastAPI 基础不错，但测试证据明显不足。为 DustGuard 建立可靠的安全网。',
    'quest.generatedDescription': '通过下一次 Push 后可验证的代码证据，提升 {skill} 能力。',
    'quest.name.python':'Python 锻造场','quest.name.fastapi':'API 要塞','quest.name.api':'契约试炼','quest.name.llm':'模型工坊','quest.name.testing':'测试地牢','quest.name.database':'数据金库','quest.name.rag':'检索迷宫','quest.name.agents':'智能体竞技场','quest.name.evaluation':'评测挑战场',
    'quest.pytest': '配置 pytest', 'quest.integration': '添加 API 集成测试', 'quest.mock': '模拟 LLM 响应', 'quest.coverage': '模块覆盖率达到 80%',
    'quest.reward': '预计奖励', 'quest.accept': '接受任务', 'quest.active': '任务进行中', 'quest.completed': '任务已完成', 'quest.note': '最终奖励以代码验证结果为准。', 'quest.repository': '目标仓库：{repository}', 'quest.freshScan': '请先运行一次 Evidence V2 扫描，建立任务基线。',
    'boss.eyebrow': '职业 BOSS / 目标岗位', 'boss.title': 'AI 工程师', 'boss.description': '当前准备度 63%。优先补齐最关键的能力缺口。', 'boss.generate': '生成任务路线',
    'boss.skill': '技能', 'boss.you': '当前', 'boss.target': '目标', 'boss.rolePlaceholder': '目标岗位：AI 工程师', 'boss.jdPlaceholder': '粘贴岗位 JD（可选）',
    'boss.readiness': '当前准备度 {readiness}%。优先补齐最关键的能力缺口。', 'boss.weeks': '第 {weeks} 周', 'boss.evidence': '代码验收标准', 'boss.closeGap': '将 {skill} 的代码证据从 {current}% 提升至接近 {target}%。', 'boss.proveSkill': '提交可检查的 {skill} 实现与测试代码。',
    'footer.slogan': '技能是声明，代码是证据。',
    'drawer.eyebrow': '已验证技能 / 代码证据', 'drawer.updated': '最近一次验证', 'drawer.level': '等级', 'drawer.confidence': 'AI 置信度',
    'drawer.why': '为什么我是 Lv.{level}？', 'drawer.evidence': '代码证据', 'drawer.signals': '{count} 条证据', 'drawer.next': '下一等级', 'drawer.empty': '已扫描的仓库中，没有发现可检查的代码证据。',
    'modal.eyebrow': '评分协议', 'modal.title': '等级只能被证明，不能自己选择。',
    'modal.description': 'DEVTREE 分析多个仓库中的实现模式，综合实现深度、重复验证和时间因素，并将每个结论链接到可检查的代码。没有证据代表未知，不代表你不会。',
    'modal.step1': '索引代码，但不存储仓库密钥。', 'modal.step2': '提取能力，并关联到文件级证据。', 'modal.step3': '按照实现深度、独立性和新鲜度评分。',
    'scan.eyebrow': '仓库扫描 / 实时', 'scan.preparing': '正在准备扫描…', 'scan.preparing.detail': '分析 Worker 会返回每个真实阶段。',
    'scan.repositories': '读取仓库', 'scan.evidence': '提取证据', 'scan.ai': '本地 AI 审核', 'scan.graph': '生成技能图谱', 'scan.retry': '重新扫描', 'scan.close': '关闭',
    'scan.queued.title': '扫描已排队', 'scan.queued.detail': '正在等待本地分析 Worker。',
    'scan.repositories.title': '正在读取仓库', 'scan.repositories.detail': '从活跃项目中选择与能力判断相关的源文件。',
    'scan.evidence.title': '正在寻找代码证据', 'scan.evidence.detail': '将真实实现模式匹配到可验证的能力。',
    'scan.ai_review.title': '本地 AI 正在审核', 'scan.ai_review.detail': 'Ollama 正在根据真实代码片段质疑或确认规则评分。',
    'scan.scoring.title': '正在生成技能图谱', 'scan.scoring.detail': '综合独立证据、实现深度和时间因素计算等级。',
    'scan.completed.title': '技能图谱已生成', 'scan.completed.detail': '每个可见等级都能追溯到代码证据。',
    'scan.failed.title': '扫描已停止', 'scan.failed.detail': '当前阶段未能完成。',
    'toast.offline': '本地 API 未运行', 'toast.oauth': '缺少 GitHub OAuth 配置', 'toast.authExpired': 'GitHub 授权已过期，请重试', 'toast.authFailed': 'GitHub 授权失败，请重试',
    'toast.quest': '任务已接受，请在目标仓库中完成', 'toast.questCompleted': '任务完成，经验值已通过代码验证并发放', 'toast.roadmap': '12 周任务路线已生成', 'toast.passport': '开发者护照已由 GitHub 代码验证', 'toast.published': '公开开发者护照已发布', 'toast.private': '开发者护照已设为私密', 'toast.copied': '公开护照链接已复制',
    'count.nodes': '已发现 {verified} / {total} 个技能节点', 'count.evidence': '{count} 条证据', 'count.none': '暂无信号', 'count.repositories': '{count} 个已验证', 'scan.verified': '已验证 {count} 个文件{model}'
  }
} as const;

export type MessageKey = keyof typeof messages.en;
let locale: Locale = localStorage.getItem('devtree_locale') === 'zh' ? 'zh' : 'en';

export function t(key: MessageKey, params: Record<string, string | number> = {}): string {
  let value: string = messages[locale][key] || messages.en[key];
  for (const [name, replacement] of Object.entries(params)) value = value.replaceAll(`{${name}}`, String(replacement));
  return value;
}

export function getLocale(): Locale { return locale; }
export function setLocale(next: Locale): void {
  locale = next;
  localStorage.setItem('devtree_locale', next);
  document.documentElement.lang = next === 'zh' ? 'zh-CN' : 'en';
  applyTranslations();
  document.dispatchEvent(new CustomEvent('devtree:localechange'));
}

export function applyTranslations(): void {
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach(element => {
    element.textContent = t(element.dataset.i18n as MessageKey);
  });
  document.querySelectorAll<HTMLElement>('[data-i18n-aria]').forEach(element => {
    element.setAttribute('aria-label', t(element.dataset.i18nAria as MessageKey));
  });
  document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[data-i18n-placeholder]').forEach(element => {
    element.placeholder = t(element.dataset.i18nPlaceholder as MessageKey);
  });
  const toggle = document.querySelector<HTMLButtonElement>('#languageToggle');
  if (toggle) { toggle.textContent = locale === 'en' ? '中' : 'EN'; toggle.setAttribute('aria-label', t('nav.language')); }
}
