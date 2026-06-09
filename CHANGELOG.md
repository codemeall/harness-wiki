# Changelog

All notable changes to `@codemeall/harness-wiki` are documented here.

## 0.1.0

Initial release. Extracted from `@codemeall/harness-bridge` into a standalone package so the LLM Wiki knowledge-base workflow stands on its own.

- **MCP tools** `vault_init` and `vault_status`, plus the `wiki_init_prompt` MCP prompt and the `harness-wiki://prompts/vault-init.md` resource.
- `vault_init` scaffolds the canonical folder structure (`raw/`, `raw/assets/`, `wiki/{entities,concepts,sources,syntheses}/`), writes `CLAUDE.md`, `AGENTS.md`, `wiki/index.md`, and `wiki/log.md`, and auto-detects whether to write standalone (empty dir) or co-located with an existing project (appends a marker-fenced `<!-- harness-wiki:vault-schema -->` block to the host `CLAUDE.md` / `AGENTS.md`, leaving host content untouched). Idempotent on re-run via the marker; refuses only on an existing `wiki/` without `force: true`.
- `vault_status` reports scaffold state and surfaces pending ingests (files in `raw/` with no matching `wiki/sources/<slug>.md`).
- **CLI** `harness-wiki mcp`, `harness-wiki vault-init`, and `harness-wiki vault-status`.
- **Prompt** `prompts/vault-init.md` bootstraps a personal markdown knowledge base maintained by an AI agent.

> Note: the vault schema marker changed from `<!-- harness-bridge:vault-schema -->` (in harness-bridge ≤ 0.1.2) to `<!-- harness-wiki:vault-schema -->`. Vaults scaffolded by the old tooling carry the old marker; re-running `vault_init` on them treats them as unmarked.
