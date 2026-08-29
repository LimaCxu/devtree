# Security policy

Please report vulnerabilities privately through GitHub Security Advisories rather than public issues.

DEVTREE processes repository source and OAuth tokens. Access and refresh tokens are encrypted at rest and refreshed automatically when GitHub expiry is enabled. Production operators must set a unique `TOKEN_ENCRYPTION_KEY`, use HTTPS, restrict database and Redis access to the private network, rotate leaked OAuth credentials, and avoid logging source content or tokens. `.env` is intentionally excluded from Git.

The local Ollama reviewer receives only bounded evidence snippets selected by deterministic rules. Model output cannot create source citations and cannot unlock a skill with no underlying evidence. When a user selects an OpenAI-compatible provider, those bounded snippets leave the local machine and are sent to the configured API. Account-level API keys are encrypted at rest and are never returned by the settings API.

Do not deploy the example Compose database password to an internet-accessible environment. Restrict `APP_URL` to the canonical origin, use a strong webhook secret, keep OAuth scopes minimal, and review outbound AI provider URLs before enabling cloud review in a multi-user deployment.
