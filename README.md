# ai-invoice-assistant

[![CI](https://github.com/AubHaddad/ai-invoice-assistant/actions/workflows/ci.yml/badge.svg)](https://github.com/AubHaddad/ai-invoice-assistant/actions/workflows/ci.yml)
[![Deploy](https://github.com/AubHaddad/ai-invoice-assistant/actions/workflows/deploy.yml/badge.svg)](https://github.com/AubHaddad/ai-invoice-assistant/actions/workflows/deploy.yml)

A streaming AI assistant where a user uploads invoices/receipts (PDF or image), asks questions in natural language, and the assistant extracts data, runs real calculations through tools, and renders structured results (tables, charts, summaries) directly in the chat UI.

## CI/CD

Pull requests run **lint**, **typecheck**, **unit tests**, and **Playwright e2e**. Merges to `main` run **promptfoo evals**, then **docker build → push → Cloud Run deploy**. Deploy does not start if evals fail.

Repository variables: `GCP_WIF_PROVIDER`, `GCP_WIF_SA`. Deploy secrets: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`.
