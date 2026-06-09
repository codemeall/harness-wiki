---
type: concept
created: 2026-06-09
updated: 2026-06-09
sources: [llm-wiki-pattern]
tags: [knowledge-management]
---

# Compounding knowledge

The core property of an [[concepts/llm-wiki]]: each source and each query leaves
a durable, interlinked artifact behind, so the knowledge base gets richer over
time rather than resetting on every interaction [[sources/llm-wiki-pattern]].

## Mechanism

- New sources update existing pages instead of being indexed in isolation.
- Good query answers can be filed back as `wiki/syntheses/` pages.
- Cross-references and contradiction flags accumulate, so later reads start ahead.

## Why humans abandon wikis

The maintenance burden (cross-references, summaries, consistency) grows faster
than the value. Agents do not get bored, so the maintenance cost stays near zero.
