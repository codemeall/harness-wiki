# Changelog

All notable changes to `@codemeall/harness-wiki` are documented here.

## 0.3.0

Committed to the **wiki↔repo↔bridge wedge** plus the one cheap-and-universal scale feature, source-hash staleness.

- **Added** source-hash staleness detection. `vault_stamp` (MCP tool + `vault-stamp` CLI) records `source_file` + `source_sha256` into each `wiki/sources/*.md` page. `vault_doctor` now reports `staleSources` (raw file changed since ingest), `unhashedSources` (not yet stamped), and `missingRawSources` (paired raw file gone). The ingest workflow in the skill, prompt, and generated schema now ends with a stamp step.
- **Added** `vault_link` (MCP tool + `vault-link` CLI): registers a sibling project in the vault's Paired-projects table **and** writes a marker-fenced back-pointer into that project's `CLAUDE.md`, making the relationship discoverable from both repos. Idempotent; re-linking the same name updates the row in place. `vault_doctor` now reports `brokenPairedProjects` (table rows whose path is missing).
- **Added** the synthesis→spec→implementation handoff to the skill and generated schema: approved syntheses hand off to the paired repo, and `harness-bridge` tracks the current work there.
- **Docs**: README now headlines the wiki↔repo↔bridge wedge; lint docs cover staleness; the example vault is stamped and verifies clean.
- **Internal**: added `slugify`-based `rawFileIndex`, a minimal frontmatter reader/writer, and `pairedProjectsFromClaude` table parsing — no new runtime dependencies.

## 0.2.0

- **Fixed** `vault_status` pending-ingest detection: filename↔source-page matching is now slug-normalized, so a raw file like `PRD Checkout V2.pdf` is correctly recognized as ingested by its kebab-case source page `prd-checkout-v2.md` instead of showing as pending forever. New `slugify` helper is the single normalization used by status and doctor.
- **Added** MCP tool + CLI `vault_doctor` / `vault-doctor`: deterministic structural health check reporting pages missing YAML frontmatter, dead `[[wikilinks]]`, orphan pages with no inbound links, and pages absent from `wiki/index.md`. Positioned as the mechanical first pass of a `lint`.
- **Added** MCP tool + CLI `vault_search` / `vault-search`: case-insensitive plain-text search across `wiki/` pages (no embeddings, no dependencies), returning file + line + matching text.
- **Added** an explicit URL-ingest rule to the skill, prompt, and generated `CLAUDE.md` schema: fetched URLs are saved into `raw/` before summarizing, preserving the immutable-source-of-truth principle. Source-page slug derivation is now documented so it stays paired with the raw filename.
- **Added** a prebuilt example vault at `examples/knowledge-vault/` (the meta-demo) so users can see real output — source, concept, entity, and synthesis pages with a populated index and log — without ingesting anything.
- **Docs**: README now opens with a one-paragraph pitch and a 4-line quickstart; the lint workflow documents the `vault_doctor` mechanical pass; a spec-sync note keeps the skill, prompt, and generated schema aligned.

## 0.1.0

Initial release. Extracted from `@codemeall/harness-bridge` into a standalone package so the LLM Wiki knowledge-base workflow stands on its own.

- **MCP tools** `vault_init` and `vault_status`, plus the `wiki_init_prompt` MCP prompt and the `harness-wiki://prompts/vault-init.md` resource.
- `vault_init` scaffolds the canonical folder structure (`raw/`, `raw/assets/`, `wiki/{entities,concepts,sources,syntheses}/`), writes `CLAUDE.md`, `AGENTS.md`, `wiki/index.md`, and `wiki/log.md`, and auto-detects whether to write standalone (empty dir) or co-located with an existing project (appends a marker-fenced `<!-- harness-wiki:vault-schema -->` block to the host `CLAUDE.md` / `AGENTS.md`, leaving host content untouched). Idempotent on re-run via the marker; refuses only on an existing `wiki/` without `force: true`.
- `vault_status` reports scaffold state and surfaces pending ingests (files in `raw/` with no matching `wiki/sources/<slug>.md`).
- **CLI** `harness-wiki mcp`, `harness-wiki vault-init`, and `harness-wiki vault-status`.
- **Prompt** `prompts/vault-init.md` bootstraps a personal markdown knowledge base maintained by an AI agent.

> Note: the vault schema marker changed from `<!-- harness-bridge:vault-schema -->` (in harness-bridge ≤ 0.1.2) to `<!-- harness-wiki:vault-schema -->`. Vaults scaffolded by the old tooling carry the old marker; re-running `vault_init` on them treats them as unmarked.
