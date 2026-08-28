# DEVTREE

**Your code becomes your skill tree.**

DEVTREE is an interactive product prototype for a code-verified developer passport. It turns repository evidence into explainable skill levels, reveals new branches through a fog-of-war skill graph, and creates real GitHub quests around demonstrated capability gaps.

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

## Run locally

```bash
npm install
npm run dev
```

The UI runs at `http://localhost:5173`. Without OAuth credentials it operates in demo mode.

## Connect a GitHub OAuth app

1. Create a GitHub OAuth App and set its callback URL to `http://localhost:5173/api/auth/callback`.
2. Copy `.env.example` to `.env` and add the client ID and secret.
3. Export those variables in your shell, then run `npm run dev`.

For a production-like local build:

```bash
npm run build
npm start
```

Set `APP_URL` to the public origin and use `<APP_URL>/api/auth/callback` as the production callback URL. GitHub access tokens are retained only in server memory in this milestone; restarting the process logs users out.

## Local Docker + Ollama deployment

DEVTREE defaults to `qwen3.6:latest`. Start Ollama and confirm the model exists, then deploy:

```bash
ollama list
docker compose up --build -d
```

Open `http://localhost:4317`. The container calls the host model through `http://host.docker.internal:11434`. To use another local model, set `OLLAMA_MODEL` before starting Compose. The `/api/health` response reports whether the configured model is reachable.

The analysis has two stages: deterministic rules first collect inspectable repository/file/line evidence, then Ollama reviews only those snippets and may adjust a level by at most one point. If Ollama is unavailable, analysis continues safely with deterministic scoring.

## Architecture

```text
Browser → Node API → PostgreSQL
              ↓
          Redis queue → Scan worker → GitHub API
                                   ↘ Local Ollama
```

OAuth states, sessions, encrypted GitHub tokens, scan jobs, and completed results survive application restarts. The API returns a job immediately; the browser polls `/api/scans/:id` while the worker analyzes repositories in the background.

For production, replace the example database password, set a long random `TOKEN_ENCRYPTION_KEY`, terminate TLS in front of the app, and keep PostgreSQL and Redis off public ports. See [SECURITY.md](SECURITY.md).

## Open source

DEVTREE is available under the MIT License. Contributions are welcome; read [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md) before submitting changes.

## Verification

```bash
npm test
npm run build
```

## Product principle

> Skills are claims. Code is evidence. Show me the code.

This milestone includes the first working GitHub analysis pipeline. Webhook rescans, durable encrypted sessions, an LLM evidence-review layer, persistence, and per-user public passport URLs remain on the production roadmap.
