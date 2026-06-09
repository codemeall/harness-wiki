# LLM Wiki

LLM Wiki is a separate product workflow from Harness Bridge. It creates a long-lived markdown knowledge base maintained by an AI agent: you curate sources and ask questions; the agent summarizes, cross-references, files, flags contradictions, and keeps the index current.

Harness Bridge tracks **current in-flight work** in one project repo. LLM Wiki tracks **durable knowledge** across projects, research, and decisions.

The pattern originates with Andrej Karpathy's [LLM Wiki gist](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f); Harness Wiki is an independent implementation that packages it as a reusable skill, MCP server, and CLI.

## What it is

An LLM Wiki is a structured, interlinked collection of markdown files:

- `raw/` holds source material you curate: articles, papers, meeting notes, transcripts, design docs, screenshots in `raw/assets/`.
- `wiki/entities/` holds people, organizations, products, places, and other named things.
- `wiki/concepts/` holds ideas, frameworks, methods, features, and design patterns.
- `wiki/sources/` holds one summary page per ingested raw source.
- `wiki/syntheses/` holds comparisons, decisions, analyses, and designs worth keeping.
- `wiki/index.md` catalogs every page with a one-line summary.
- `wiki/log.md` records every ingest, query, lint, and schema operation.

Unlike file-upload RAG, the wiki compiles knowledge into durable pages. New sources update the existing structure instead of being retrieved from scratch on every query.

## LLM Wiki vs Harness Bridge

| | LLM Wiki | Harness Bridge |
|---|---|---|
| Primary job | Preserve durable knowledge and decisions | Resume one in-progress coding task |
| Scope | Cross-project or long-lived domain context | One project repo and current task |
| Lifespan | Months or years | Per task / per handoff |
| Path | A vault directory | `.harness/bridge.md` in a project repo |
| Main operations | Ingest, query, lint | Init, checkpoint, produce, consume, recover |

Use both together when a project has meaningful design history: the wiki stores the *why*, the project repo stores the *what*, and the bridge stores the *current work*.

## When to use it

Set up an LLM Wiki when:

- You are starting a non-trivial project and want design history preserved separately from implementation.
- You are doing research across many sources over weeks or months.
- You want a reusable product/design memory that future AI sessions can query.
- You have multiple sibling repos that share decisions, concepts, or research.
- You want contradictions and stale assumptions surfaced instead of buried in old chats.

Skip it for one-off tasks, ephemeral notes, or reference material that is already easy to find elsewhere.

## Setup

Harness Wiki is skill-first. Load the portable skill first, let MCP accelerate setup when available, and use the prompt/manual path as the fallback.

### 1. Load the skill

Load `skills/harness-wiki/SKILL.md` into your agent or harness, then open the target directory and say:

```text
Use the Harness Wiki skill to initialize an LLM Wiki vault here.
Name: "knowledge"
Domain: software project
```

The skill covers initialization, ingest, query, lint, paired projects, and schema maintenance. After initialization, the generated `CLAUDE.md` / `AGENTS.md` schema is the local source of truth.

Provider examples:

| Harness | Skill usage |
|---|---|
| Codex-style skills | Install or copy `skills/harness-wiki/SKILL.md` into the skills directory, then ask Codex to use the Harness Wiki skill. |
| Claude-style project instructions | Add the skill text to project instructions or paste it at session start; after init, follow `CLAUDE.md`. |
| ChatGPT/custom harnesses | Load the skill as system/developer instructions or the first message. |
| Generic agents | Paste the skill text and point the agent at the target directory. |

The packaged skill can also be installed with:

```bash
npx -y @codemeall/harness-wiki skill-install claude          # ~/.claude/skills
npx -y @codemeall/harness-wiki skill-install claude-project  # ./.claude/skills
npx -y @codemeall/harness-wiki skill-install codex           # ~/.codex/skills
npx -y @codemeall/harness-wiki skill-install agents          # ~/.agents/skills
npx -y @codemeall/harness-wiki skill-install local           # ./.agents/skills
npx -y @codemeall/harness-wiki skill-install --target ./path/to/skills
```

### 2. Use MCP if available

Configure the package as an MCP server in your agent:

```bash
npx -y @codemeall/harness-wiki mcp
```

Or from a Git checkout:

```bash
git clone <repo-url>
cd harness-wiki
npm install
npm run build
node /absolute/path/to/harness-wiki/dist/cli.js mcp
```

Open the target directory in your agent and say:

```text
Use the Harness Wiki skill to initialize an LLM Wiki vault here.
Name: "knowledge"
Domain: software project
```

When MCP is available, the skill should call `vault_init` with `cwd` set to the target workspace absolute path. The tool auto-detects the scenario:

| Scenario | Result |
|---|---|
| Empty directory | Writes a standalone vault with `raw/`, `wiki/`, `CLAUDE.md`, `AGENTS.md`, `wiki/index.md`, and `wiki/log.md`. |
| Existing project repo | Creates the vault folders in place and appends a marker-fenced vault schema to the host `CLAUDE.md` / `AGENTS.md` without overwriting existing content. |

Use `vault_status` any time to report scaffold state and list files in `raw/` that do not yet have matching `wiki/sources/<slug>.md` pages. Pass `cwd` for the workspace you want inspected.

### 3. Prompt/manual fallback

If your agent cannot load skills or use MCP:

1. Open the directory that should become the vault.
2. Paste [`prompts/vault-init.md`](../prompts/vault-init.md) as the first message.
3. Answer the agent's domain questions.
4. Review the generated `CLAUDE.md`, `AGENTS.md`, `wiki/index.md`, and `wiki/log.md`.
5. Optionally `git init` the vault if you want history.

## Daily workflow

LLM Wiki has three operations: ingest, query, and lint.

### Ingest

Drop a source into `raw/`, then tell the agent:

```text
ingest raw/prd-checkout-v2.md
```

The agent reads the source, surfaces key takeaways before writing, then creates or updates the relevant source, entity, concept, synthesis, index, and log pages after your confirmation.

You can also ingest a URL (`ingest https://…`). The agent first saves the fetched content into `raw/` so the source stays immutable and traceable, then ingests that local copy.

Good sources include design specs, ADRs, meeting transcripts, user interviews, research notes, articles, papers, and substantive product feedback.

### Query

Ask normal questions:

```text
What did we decide about guest checkout?
```

The agent reads `wiki/index.md`, drills into relevant pages, follows `[[wikilinks]]`, and answers with citations back to wiki pages and source summaries. If the answer is a durable synthesis, the agent can file it as a new `wiki/syntheses/<slug>.md`.

### Lint

Periodically ask:

```text
lint
```

The agent starts with a mechanical pass — `vault_doctor` reports pages missing frontmatter, dead `[[wikilinks]]`, orphan pages, pages absent from the index, **stale source pages** (the raw file changed since ingest), and **broken paired-project paths** — then audits for the judgment calls: contradictions, stale claims, missing cross-references, important concepts without pages, and useful next sources or questions.

Staleness works because each ingest records the source file's SHA-256 in the source page (via `vault_stamp`). When the raw file later changes, the hashes diverge and the page is flagged so you can re-ingest and re-stamp.

For large vaults, `vault_search` does a plain-text search across all wiki pages so the agent can locate relevant pages before answering rather than relying on `wiki/index.md` alone.

## Paired projects

A vault can feed one or more sibling project repos. The vault stores design rationale, research, and decisions; project repos store implementation and public deliverables.

The generated schema includes a `Paired projects` table:

```markdown
## Paired projects
| Project | Path | Purpose | Status |
|---|---|---|---|
| <project-name> | `../<project-name>/` | <one line> | <design / building / shipped> |
```

Register a project with `vault_link` rather than hand-editing the table: it adds (or updates) the row and writes a marker-fenced back-pointer into the project's `CLAUDE.md`, so the relationship is discoverable from either repo. `vault_doctor` flags rows whose path no longer exists.

When a synthesis becomes an approved design, implementation should happen in the project repo. If the implementation session is long-running, use Harness Bridge inside that project repo to maintain `.harness/bridge.md`. This is the wiki↔repo↔bridge handoff: the wiki holds the *why*, the repo holds the *what*, the bridge holds the *current work*.

## What belongs where

| Goes in LLM Wiki | Goes in project repo |
|---|---|
| Why you chose one approach over another | Code, tests, and shipped docs |
| Raw notes, interviews, research, competitive context | Public README and changelog |
| Design rationale and private decision history | Contributor-facing design docs |
| Cross-project concepts and syntheses | Project-specific implementation state |

A useful test: if a contributor needs it to understand or change the code, it probably belongs in the project repo. If it is private context, exploration, or long-term thinking, it belongs in the wiki.

## CLI fallback

The `harness-wiki` package includes local CLI commands:

```bash
harness-wiki vault-init --name "knowledge" --domain "software project" [--cwd <path>]
harness-wiki vault-status [--cwd <path>]
harness-wiki skill-install <codex|agents|local>
```

From a Git checkout:

```bash
node /absolute/path/to/harness-wiki/dist/cli.js vault-init --name "knowledge"
node /absolute/path/to/harness-wiki/dist/cli.js vault-status
```

`harness-wiki mcp` starts a stdio MCP server and waits for an MCP client. If it appears to hang in a terminal, that is expected; use direct CLI commands for terminal setup.

## Uninstall

An LLM Wiki is just a folder of markdown files. To remove it, delete the vault folder or remove it from your editor/Obsidian workspace. Nothing is registered globally.
