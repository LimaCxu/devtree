# Contributing to DEVTREE

Thank you for helping build code-verifiable developer profiles.

1. Fork the repository and create a focused branch.
2. Run `npm install`, `npm test`, and `npm run build` before opening a pull request.
3. Add tests for scoring rules, API behavior, or regressions introduced by your change.
4. Never include GitHub tokens, OAuth secrets, private source code, or generated `.env` files.
5. Explain how new skill rules map to inspectable code evidence and how false positives are constrained.

Recommended full-stack setup:

```bash
cp .env.example .env
docker compose up --build -d
npm test
npm run build
```

Keep pull requests focused. Changes to scoring thresholds, capability rules, privacy defaults, OAuth scopes, or encryption behavior must include tests and a short rationale in the pull request description.

Bug reports should include reproducible steps, expected behavior, logs with secrets removed, and the relevant deployment mode.
