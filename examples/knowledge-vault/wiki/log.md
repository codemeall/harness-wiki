# Log

Append-only chronological record. Each entry starts with `## [YYYY-MM-DD] <op> | <title>` so it's greppable.

## [2026-06-09] schema | Vault initialized
- Created folder structure and schema files.
- Ready for first ingest.

## [2026-06-09] ingest | The LLM Wiki pattern
- Source: `raw/llm-wiki-pattern.md` → `wiki/sources/llm-wiki-pattern.md`.
- Created concepts `llm-wiki`, `compounding-knowledge`; entity `andrej-karpathy`.
- Filed synthesis `llm-wiki-vs-rag`; updated `index.md`.

## [2026-06-09] query | How is an LLM Wiki different from RAG?
- Answered from `concepts/llm-wiki` + `sources/llm-wiki-pattern`.
- Filed the durable comparison as `syntheses/llm-wiki-vs-rag`.

## [2026-06-09] lint | First health check
- `vault_doctor`: 5 pages, no missing frontmatter, no dead links, no orphans, all in index. Clean.
