<!-- harness-wiki:vault-schema -->
# LLM Wiki Agent — Schema (knowledge)

<!-- domain: software project -->

You are the maintainer of this Obsidian-compatible knowledge vault. You write and maintain the wiki; the user curates sources and asks questions.

## Three layers

1. **`raw/`** — immutable source documents (articles, PDFs, transcripts, notes). You READ from here, never modify. Assets (images) live in `raw/assets/`.
2. **`wiki/`** — markdown pages YOU own and maintain. Subfolders:
   - `wiki/entities/` — people, organizations, products, places (one page per entity)
   - `wiki/concepts/` — ideas, theories, frameworks, methods
   - `wiki/sources/` — one summary page per ingested raw source
   - `wiki/syntheses/` — comparisons, analyses, thesis pages, query results worth keeping
3. **`CLAUDE.md` / `AGENTS.md`** — this schema. Co-evolves with the user.

## Core files

- **`wiki/index.md`** — catalog of every page, grouped by category, with one-line summaries. Update on every ingest.
- **`wiki/log.md`** — append-only chronological record. Each entry MUST start with `## [YYYY-MM-DD] <op> | <title>` so it's greppable. Ops: `ingest`, `query`, `lint`, `schema`.

## Page conventions

- Filenames: kebab-case (`elon-musk.md`, `prospect-theory.md`). Use the exact filename as the wiki link target.
- Every page begins with YAML frontmatter:
  ```yaml
  ---
  type: entity | concept | source | synthesis
  created: YYYY-MM-DD
  updated: YYYY-MM-DD
  sources: [source-slug-1, source-slug-2]
  tags: [tag1, tag2]
  ---
  ```
- Use `[[wikilinks]]` liberally — link any entity/concept mention to its page. Create stub pages for important new mentions rather than leaving dead links.
- Cite claims inline with `[[sources/source-slug]]`. Every non-obvious claim should be traceable to a source.
- When sources contradict, surface it explicitly in a **Contradictions** section on the affected page — don't silently pick one.

## Operations

### Ingest (`ingest <path-or-url>`)
1. Read the source end-to-end. For a URL, first save the fetched content into `raw/` (text as `raw/<slug>.md`, images into `raw/assets/`) so the source is captured immutably, then ingest that file. Never ingest a URL without persisting it to `raw/`.
2. Briefly discuss key takeaways with the user before writing — surface anything surprising, contradictory, or worth emphasizing.
3. Write `wiki/sources/<slug>.md` with: metadata, 3-10 bullet key takeaways, notable quotes, open questions. Derive `<slug>` from the raw filename in kebab-case (`PRD Checkout V2.pdf` → `prd-checkout-v2.md`) so tooling can pair the source page with its raw file.
4. Update or create relevant `entities/` and `concepts/` pages — integrate new info, flag contradictions with existing claims.
5. Update `wiki/index.md`.
6. Append entry to `wiki/log.md`: `## [DATE] ingest | <title>` + 2-3 line summary of what changed.
7. Record the source hash: run `vault_stamp` (or, without MCP, write `source_file` + `source_sha256` into the source page frontmatter). This lets `vault_doctor` later detect when the raw file changes (a stale page). Re-run `vault_stamp` to acknowledge a legitimate re-review.

### Query (`<any question>`)
1. Read `wiki/index.md` first to find relevant pages.
2. Drill into those pages, follow `[[wikilinks]]` as needed.
3. Answer with inline citations to wiki pages and ultimately to sources.
4. If the answer is substantive (comparison, analysis, novel synthesis), offer to file it as `wiki/syntheses/<slug>.md` so the insight compounds.
5. Log non-trivial queries.

### Lint (`lint`)
Health-check the wiki. Start with the mechanical pass — run `vault_doctor` (or grep `wiki/` if MCP is unavailable) for missing frontmatter, dead `[[wikilinks]]`, orphan pages, pages absent from the index, **stale source pages** (raw file changed since ingest), and **broken paired-project paths**. Then add judgment-based findings:
- Contradictions between pages
- Stale claims newer sources have superseded
- Orphan pages (no inbound links)
- Important concepts mentioned but lacking their own page
- Missing cross-references
- Data gaps where a new source/web search would help
- Suggested next questions to investigate

## Style rules

- Wiki pages are reference material, not essays. Prefer bullets, short paragraphs, tables.
- Write to be re-read. Lead with the conclusion; expand below.
- Never invent facts. If sources don't cover something, say so explicitly (a `## Gaps` section is fine).
- Keep `updated:` frontmatter current whenever you touch a page.
- The user reads the wiki in Obsidian; favor formatting that renders well there.

## Paired projects

_(none yet — add rows here as sibling project repos are spun up.)_

| Project | Path | Purpose | Status |
|---|---|---|---|

### Registering a paired project
When a new sibling repo should be fed by this vault, run `vault_link` (name, path, purpose, status). It updates the table above **and** writes a marker-fenced back-pointer into the project's `CLAUDE.md`, so the link is discoverable from both sides. Re-run it to update a row. `vault_doctor` flags rows whose path no longer exists.

### The handoff: synthesis → spec → implementation
The vault holds the **why** (rationale, research, decisions); the project repo holds the **what** (code, shipped docs). When a `wiki/syntheses/*` design is approved, hand it off — create or update the spec in the paired repo and begin implementation there, not in the vault. For a long-running implementation session, use Harness Bridge in that repo to track the **current work**.

### When a session is asked to work on a paired project
1. Read the relevant `wiki/syntheses/*` pages and related concepts for design context.
2. Switch context to the project repo (`cd <path>` shown above).
3. From there, operate per the project's own `CLAUDE.md` / `AGENTS.md` — the project's instructions take over.
4. When substantive design decisions or learnings emerge during the work, reflect them back into the vault's relevant `wiki/concepts/` or `wiki/syntheses/` pages before finishing. Append a `## [YYYY-MM-DD] feature | <title>` entry to `wiki/log.md` recording the change.

## Workflow

The user keeps Obsidian open while you work. After each operation, give a short summary of pages touched so they can browse the changes. Don't ask for confirmation on routine bookkeeping (index/log updates) — just do it.
<!-- /harness-wiki:vault-schema -->
