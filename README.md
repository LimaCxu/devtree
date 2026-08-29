# DEVTREE

[![CI](https://github.com/LimaCxu/devtree/actions/workflows/ci.yml/badge.svg)](https://github.com/LimaCxu/devtree/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-27d8d0.svg)](LICENSE)
[![Node.js 22+](https://img.shields.io/badge/Node.js-22%2B-111820.svg)](package.json)

**Your code becomes your skill tree.**

DEVTREE is an open-source, code-verified developer passport. It turns repository evidence into explainable skill levels, reveals new branches through a fog-of-war skill graph, and creates real GitHub quests around demonstrated capability gaps.

> **Alpha software:** scoring rules and database schemas are evolving. Do not expose a local instance to the public internet without reviewing `SECURITY.md` and replacing every example secret.

## Product features

- Interactive skill graph with verified, emerging, and undiscovered nodes
- File-level evidence drawer explaining every AI-assigned level
- AI-generated development quest with estimated XP rewards
- Career Boss gap analysis and quest-line generator
- Responsive developer passport designed for public sharing
- GitHub OAuth with server-side, `HttpOnly` sessions
- Repository and source-file scanning through the GitHub API
- Explainable, deterministic capability scoring with file and line citations
- Demo fallback when OAuth credentials are not configured
- Local Ollama review that calibrates rule scores without inventing evidence
- Docker Compose deployment with host Ollama connectivity
- PostgreSQL persistence for encrypted OAuth tokens, sessions, and scan history
- Redis-backed asynchronous scan worker with durable job status
- End-to-end TypeScript for browser, API, database, analyzer, and worker
- Real scan stages, resumable progress, actionable failures, and retry controls
- English/Chinese interface switching across static and live scan states
- Evidence V2 scoring with source-kind weights, repository deduplication, commit-pinned citations, and adversarial Ollama review
- Persistent quests with signed GitHub push webhooks and changed-file verification
- Private-by-default Developer Passports with explicit publishing and shareable `/p/<github-login>` pages
- Persisted Career Boss targets generated from a role/JD, current code evidence, and a 4/8/12-week quest line
- Idempotent GitHub webhook delivery handling and one-time, transactional Quest XP rewards
- Account-level AI settings for local Ollama or OpenAI-compatible APIs, with encrypted keys and connection testing

## Quick start

```bash
cp .env.example .env
# Add your GitHub OAuth client ID, secret, and a strong encryption key.
docker compose up --build -d
```

Open `http://localhost:4317`. PostgreSQL, Redis, the API, and the scan worker run in Docker; Ollama runs on the host. For frontend-only development, use `npm install && npm run dev` and open `http://localhost:5173`.

## Connect a GitHub OAuth app

1. Create a GitHub OAuth App and set its callback URL to `http://localhost:5173/api/auth/callback`.
2. Copy `.env.example` to `.env` and add the client ID and secret.
3. Export those variables in your shell, then run `npm run dev`.

OAuth defaults to the minimal `read:user` scope, which scans public repositories. To explicitly include private repositories, set `GITHUB_OAUTH_SCOPE="read:user repo"` and reconnect GitHub; GitHub's legacy OAuth Apps do not provide a narrower read-only private-repository scope.

For a production-like local build:

```bash
npm run build
npm start
```

Set `APP_URL` to the public origin and use `<APP_URL>/api/auth/callback` as the production callback URL. Sessions and encrypted OAuth tokens are stored in PostgreSQL and survive restarts.

## Local Docker + Ollama deployment

DEVTREE defaults to `qwen3.6:latest`. Start Ollama and confirm the model exists, then deploy:

```bash
ollama list
docker compose up --build -d
```

Open `http://localhost:4317`. The container calls the host model through `http://host.docker.internal:11434`. To use another local model, set `OLLAMA_MODEL` before starting Compose. The `/api/health` response reports whether the configured model is reachable.

Custom OpenAI-compatible endpoints are denied by default. Add only trusted hostnames to the server-side allowlist, for example `AI_ALLOWED_HOSTS=models.example.com`. Ollama is limited to local hosts unless explicitly allowlisted.

The analysis reports four real stages: repository indexing, evidence extraction, local AI review, and skill scoring. Ollama reviews only selected snippets and may confirm or lower a rule score, never raise it. If Ollama is unavailable, analysis continues safely with deterministic scoring.

Evidence V2 treats imports and configuration as supporting signals rather than proof of mastery, discounts test evidence for production skills, folds duplicate matches within one repository, and pins citations to the scanned commit. Ollama may confirm or lower the deterministic level; it cannot raise it.

### Configure AI in the page

After connecting GitHub, open **AI** in the top navigation. Each account can choose:

- `Ollama · Local`: base URL and model; no API key required.
- `OpenAI-compatible API`: base URL, model, and API key.

Use **Test connection** before saving. API keys are encrypted with `TOKEN_ENCRYPTION_KEY`, never returned to the browser, and never written to client storage. Local Ollama remains the default. A cloud provider receives only the evidence snippets selected for adversarial review, so the settings panel explicitly shows that privacy boundary.

To enable push-driven Quest verification, set `GITHUB_WEBHOOK_SECRET` and configure the repository webhook to send `push` events to `<APP_URL>/api/webhooks/github` with the same secret. Localhost needs a secure tunnel before GitHub can deliver webhooks.

## Architecture

```text
Browser → Node API → PostgreSQL
              ↓
          Redis queue → Scan worker → GitHub API
                                   ↘ Local Ollama
```

OAuth states, sessions, encrypted GitHub tokens, scan jobs, and completed results survive application restarts. The API returns a job immediately; the browser polls `/api/scans/:id` while the worker analyzes repositories in the background.

Developer Passports are private by default. After a signed-in developer explicitly publishes one, the read-only public route is `/p/<github-login>`. Making the Passport private immediately disables the public API and route. Career targets and generated roadmaps are stored per developer and restored on the next visit.

Shared contracts live in `shared/types.ts`. Vite builds the browser bundle while TypeScript compiles the Node API and worker into `dist-server` for the production container.

For production, replace the example database password, set a long random `TOKEN_ENCRYPTION_KEY`, terminate TLS in front of the app, and keep PostgreSQL and Redis off public ports. See [SECURITY.md](SECURITY.md).

## Open source

DEVTREE is available under the MIT License. Contributions are welcome; read [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md) before submitting changes.

- [Report a bug](https://github.com/LimaCxu/devtree/issues/new?template=bug_report.yml)
- [Propose a feature](https://github.com/LimaCxu/devtree/issues/new?template=feature_request.yml)
- [Read the changelog](CHANGELOG.md)

## Verification

```bash
npm test
npm run typecheck
npm run build
```

## Product principle

> Skills are claims. Code is evidence. Show me the code.

This milestone includes the working GitHub analysis pipeline, durable encrypted sessions, local LLM evidence review, resumable scan state, inspectable code citations, push-triggered Quest verification, public Passport URLs, and evidence-based Career Boss roadmaps.
