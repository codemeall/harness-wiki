---
type: source
created: 2026-06-09
updated: 2026-06-09
sources: [llm-wiki-pattern]
tags: [pattern, knowledge-management]
source_file: raw/llm-wiki-pattern.md
source_sha256: e80d9ad85b3083a7a509fa79ff2f3ae14867e56d20358064473b027b0d417859
---

# Source: The LLM Wiki pattern

**Raw file:** `raw/llm-wiki-pattern.md` · **Author:** [[entities/andrej-karpathy]]

## Key takeaways

- An [[concepts/llm-wiki]] is a persistent, interlinked markdown layer between you and your raw sources.
- It differs from RAG: knowledge is compiled once and kept current, not re-derived per query. See [[syntheses/llm-wiki-vs-rag]].
- The agent integrates each new source into existing pages — this is [[concepts/compounding-knowledge]].
- The human curates and asks questions; the agent does all the bookkeeping.
- The pattern is deliberately abstract — an idea to instantiate per domain, not a fixed implementation.

## Notable quotes

> "Obsidian is the IDE; the LLM is the programmer; the wiki is the codebase."

## Open questions

- At what scale does an index-first lookup need to be replaced by search?
- How should contradiction detection behave when sources are ingested out of order?
