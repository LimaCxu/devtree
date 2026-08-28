# Security policy

Please report vulnerabilities privately through GitHub Security Advisories rather than public issues.

DEVTREE processes repository source and OAuth tokens. Access and refresh tokens are encrypted at rest and refreshed automatically when GitHub expiry is enabled. Production operators must set a unique `TOKEN_ENCRYPTION_KEY`, use HTTPS, restrict database and Redis access to the private network, rotate leaked OAuth credentials, and avoid logging source content or tokens. `.env` is intentionally excluded from Git.

The local Ollama reviewer receives only bounded evidence snippets selected by deterministic rules. Model output cannot create source citations and cannot unlock a skill with no underlying evidence.
