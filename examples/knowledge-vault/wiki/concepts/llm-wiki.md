---
type: concept
created: 2026-06-09
updated: 2026-06-09
sources: [llm-wiki-pattern]
tags: [pattern, knowledge-management]
---

# LLM Wiki

A long-lived, agent-maintained markdown knowledge base. The human curates raw
sources and asks questions; the agent summarizes, cross-references, files,
flags contradictions, and keeps an index and log current [[sources/llm-wiki-pattern]].

## Three layers

- **`raw/`** — immutable source documents you curate.
- **`wiki/`** — agent-owned pages: entities, concepts, sources, syntheses.
- **schema** — `CLAUDE.md` / `AGENTS.md` defining conventions and operations.

## Why it works

The value compounds because the agent does the maintenance humans abandon — see
[[concepts/compounding-knowledge]]. Contrast with retrieval-only approaches in
[[syntheses/llm-wiki-vs-rag]].

## Operations

`ingest` (add a source), `query` (ask a question), `lint` (health-check).
