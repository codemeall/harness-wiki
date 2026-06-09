# Example vault

`knowledge-vault/` is a small, complete LLM Wiki you can browse to see what the
agent produces — without ingesting anything yourself. It is the **meta-demo**:
the vault's first source is the LLM Wiki pattern itself, so the wiki documents
the idea that created it.

## What to look at

- `raw/llm-wiki-pattern.md` — the one immutable source.
- `wiki/sources/llm-wiki-pattern.md` — the agent's summary of that source.
- `wiki/concepts/`, `wiki/entities/`, `wiki/syntheses/` — pages the agent created
  and cross-linked while ingesting.
- `wiki/index.md` — the catalog the agent reads first on every query.
- `wiki/log.md` — the append-only record of ingest / query / lint operations.
- `CLAUDE.md` — the schema the agent follows (the operating contract).

Open the folder in Obsidian and use the graph view to see the cross-references.

## Try the tools against it

```bash
npx -y @codemeall/harness-wiki vault-status  --cwd examples/knowledge-vault
npx -y @codemeall/harness-wiki vault-doctor  --cwd examples/knowledge-vault
npx -y @codemeall/harness-wiki vault-search "RAG" --cwd examples/knowledge-vault
```

`vault-doctor` reports it clean (no missing frontmatter, dead links, orphans, or
unindexed pages); `vault-status` shows no pending ingests because the raw file is
paired to its source page.
