---
type: synthesis
created: 2026-06-09
updated: 2026-06-09
sources: [llm-wiki-pattern]
tags: [comparison, knowledge-management]
---

# LLM Wiki vs. file-upload RAG

A durable comparison filed from a query, per the [[concepts/llm-wiki]] workflow.

| | LLM Wiki | File-upload RAG |
|---|---|---|
| When work happens | At ingest time (compiled once) | At query time (re-derived each call) |
| Artifact | Persistent, interlinked pages | Ephemeral retrieved chunks |
| Cross-references | Maintained and accumulating | None |
| Contradictions | Flagged explicitly on the page | Invisible until they collide in an answer |
| Best for | Long-lived domains, research, decisions | One-off lookups over a fixed corpus |

## Takeaway

RAG optimizes retrieval; the wiki optimizes synthesis. The wiki's edge is
[[concepts/compounding-knowledge]] — see [[sources/llm-wiki-pattern]].
