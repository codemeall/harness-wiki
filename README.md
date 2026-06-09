# Harness Wiki

**Skill-first tooling to scaffold and maintain an _LLM Wiki_ — a long-lived, agent-maintained markdown knowledge vault.**

You curate sources and ask questions; the agent summarizes, cross-references, files, flags contradictions, and keeps an index and log current. Unlike file-upload RAG, an LLM Wiki compiles knowledge into durable, interlinked pages instead of retrieving chunks from scratch on every query.

> **Companion product.** [`@codemeall/harness-bridge`](https://github.com/codemeall/harness-bridge) tracks the **current in-flight task** in one repo via `.harness/bridge.md`. Harness Wiki tracks the **durable knowledge** around many tasks — research, design rationale, decisions. Use them together: wiki for the *why*, project repos for the *what*, bridge files for the *current work*.

## Quickstart

In any agent that can load a skill (Claude Code, Codex, …), open the folder you want to become your knowledge base and say:

```text
Use the Harness Wiki skill to initialize an LLM Wiki vault here. Name: knowledge. Domain: <your topic>.
```

Then just work with it in plain language:

1. **Feed it** — drop a file into `raw/`, then say `ingest raw/<file>` (or `ingest <url>`).
2. **Ask it** — ask any question; the agent answers from the wiki with citations.
3. **Maintain it** — say `lint` for a periodic health check.

That's the whole loop. You curate and ask; the agent does the summarizing, cross-referencing, and filing. **Want to see the output before installing anything?** Browse [`examples/knowledge-vault/`](./examples/) — a small, complete vault.

## The wedge: wiki ↔ repo ↔ bridge

Notes apps store text; Harness Wiki stores *decisions and the work they feed*. A vault registers the sibling project repos it serves (`vault_link`), so design rationale connects to implementation: the **wiki holds the why**, the **project repo holds the what**, and [`harness-bridge`](https://github.com/codemeall/harness-bridge) holds the **current work**. When a synthesis is approved, it hands off to the paired repo for implementation — and substantive decisions made there flow back into the vault. `vault_doctor` keeps the structure honest: stale source pages (the raw file changed since you ingested it) and broken project links get flagged on every health check.

## What you get

`harness-wiki` gives agents a portable skill for the full vault lifecycle. MCP and CLI commands are optional accelerators for deterministic scaffold/status operations; the actual ingest/query/lint operations are agent-driven, guided by the skill and the schema written into `CLAUDE.md` / `AGENTS.md`.

```
raw/                       # immutable source documents you curate (assets in raw/assets/)
wiki/entities/             # people, orgs, products, places — one page each
wiki/concepts/             # ideas, frameworks, methods, patterns
wiki/sources/              # one summary page per ingested raw source
wiki/syntheses/            # comparisons, analyses, decisions worth keeping
wiki/index.md              # catalog of every page
wiki/log.md                # append-only operations log
CLAUDE.md / AGENTS.md      # the agent schema (carries the vault marker)
```

## Installation

Install the packaged skill into your agent's skills directory with one command — no global install, no manual file copying:

```bash
npx -y @codemeall/harness-wiki skill-install claude          # Claude Code (~/.claude/skills)
npx -y @codemeall/harness-wiki skill-install claude-project  # this project's ./.claude/skills
npx -y @codemeall/harness-wiki skill-install codex           # Codex (~/.codex/skills)
npx -y @codemeall/harness-wiki skill-install --target <dir>  # any custom skills directory
```

| Preset | Installs to |
|---|---|
| `claude` | `~/.claude/skills` (Claude Code, personal) |
| `claude-project` | `./.claude/skills` (Claude Code, this project) |
| `codex` | `~/.codex/skills` (Codex, personal) |
| `agents` | `~/.agents/skills` (generic agents, personal) |
| `local` | `./.agents/skills` (generic agents, this project) |

Once installed, open the folder you want to become a vault and tell your agent: *"Use the Harness Wiki skill to initialize an LLM Wiki vault here."*

For MCP-capable agents, also run the server (no install):

```bash
npx -y @codemeall/harness-wiki mcp
```

For direct terminal setup without installing globally:

```bash
npx -y @codemeall/harness-wiki vault-init --name "knowledge" --domain "software project"
npx -y @codemeall/harness-wiki vault-status
```

Or install globally for the CLI:

```bash
npm install -g @codemeall/harness-wiki
```

From a Git checkout:

```bash
git clone https://github.com/codemeall/harness-wiki.git
cd harness-wiki
npm install
npm run build
```

Requires Node.js >= 20.

## Usage

### Skill-first usage

Load [`skills/harness-wiki/SKILL.md`](./skills/harness-wiki/SKILL.md) into your agent or harness, then open the directory you want to become a vault and say:

```text
Use the Harness Wiki skill to initialize an LLM Wiki vault here.
Name: "knowledge"
Domain: software project
```

The skill covers initialization, ingest, query, lint, paired projects, and schema maintenance. Once the vault exists, the generated `CLAUDE.md` / `AGENTS.md` schema becomes the local operating contract.

**Codex-style skills:** install or copy `skills/harness-wiki/SKILL.md` into your skills directory, then ask Codex to use the Harness Wiki skill in the vault directory.

You can install the packaged skill with the CLI:

```bash
npx -y @codemeall/harness-wiki skill-install claude
npx -y @codemeall/harness-wiki skill-install claude-project
npx -y @codemeall/harness-wiki skill-install codex
npx -y @codemeall/harness-wiki skill-install agents
npx -y @codemeall/harness-wiki skill-install local
```

Use `--target <skillsDir>` for a custom harness skills directory:

```bash
npx -y @codemeall/harness-wiki skill-install --target ./.agents/skills
```

**Claude-style project instructions:** add the skill text to project instructions or paste it at the start of the session. After initialization, Claude should follow the generated `CLAUDE.md`.

**ChatGPT/custom harnesses:** load the skill as the system/developer instruction or first user message for the session. If your harness supports local tools, expose MCP as described below.

**Generic agents:** paste the skill text, then point the agent at the target directory. The skill includes the manual non-MCP setup path.

### MCP accelerator

Register Harness Wiki as an MCP server when your agent supports MCP. The skill will use MCP for deterministic scaffold/status operations. Example MCP client config:

```json
{
  "mcpServers": {
    "harness-wiki": {
      "command": "npx",
      "args": ["-y", "@codemeall/harness-wiki", "mcp"]
    }
  }
}
```

From a local build, point at the built CLI instead:

```json
{
  "mcpServers": {
    "harness-wiki": {
      "command": "node",
      "args": ["/absolute/path/to/harness-wiki/dist/cli.js", "mcp"]
    }
  }
}
```

Then open the directory you want to become a vault and tell the agent:

```text
Use the Harness Wiki skill to initialize an LLM Wiki vault here.
Name: "knowledge"
Domain: software project
```

When calling MCP tools, the agent should pass the target workspace absolute path as `cwd`. This avoids initializing the MCP server launch directory instead of the project directory.

**MCP tools**

| Tool | Purpose |
|---|---|
| `vault_init` | Scaffold the vault at optional `cwd`: creates `raw/`, `wiki/{entities,concepts,sources,syntheses}/`, `CLAUDE.md`, `AGENTS.md`, `wiki/index.md`, `wiki/log.md`. Auto-detects empty dir (standalone vault) vs. existing project (appends a marker-fenced `<!-- harness-wiki:vault-schema -->` block to the host `CLAUDE.md` / `AGENTS.md` without touching other content). Idempotent on re-run via the marker. |
| `vault_status` | Report scaffold state at optional `cwd` and list files in `raw/` with no matching `wiki/sources/<slug>.md` (pending ingests). Filename/slug matching is normalized, so `PRD Checkout V2.pdf` pairs with `prd-checkout-v2.md`. |
| `vault_doctor` | Deterministic structural health check: pages missing YAML frontmatter, dead `[[wikilinks]]`, orphan pages with no inbound links, and pages absent from `wiki/index.md`. The mechanical first pass of a `lint`. |
| `vault_search` | Plain-text search across all `wiki/` pages (case-insensitive), returning file + line + matching text. For locating relevant pages in a large vault before answering a query. |
| `vault_stamp` | Record `source_file` + `source_sha256` into source-page frontmatter so `vault_doctor` can detect when a raw source file changes (a stale page). Run after each ingest; re-run to acknowledge a re-review. |
| `vault_link` | Register a sibling project in the Paired-projects table and write a marker-fenced back-pointer into that repo's `CLAUDE.md`. The wiki↔repo wedge — discoverable from both sides, idempotent. |

**MCP prompt:** `wiki_init_prompt` returns the canonical setup/operations prompt (also available as the resource `harness-wiki://prompts/vault-init.md`).

### CLI

```bash
harness-wiki mcp                                              # run the MCP server (stdio)
harness-wiki vault-init --name "knowledge" --domain "software project" [--cwd <path>] [--force]
harness-wiki vault-status [--cwd <path>]
harness-wiki vault-doctor [--cwd <path>]                      # structural health check
harness-wiki vault-search "<query>" [--cwd <path>] [--limit <n>]
harness-wiki vault-stamp [--cwd <path>]                       # record source hashes for staleness
harness-wiki vault-link --name <n> --path <p> --purpose <text> --status <text> [--cwd <path>]
harness-wiki skill-install <codex|agents|local> [--force]
harness-wiki skill-install --target <skillsDir> [--force]
```

From a Git checkout, substitute `node /absolute/path/to/harness-wiki/dist/cli.js` for `harness-wiki`.

`harness-wiki mcp` is a stdio server command. It looks idle when run directly because it is waiting for an MCP client; configure it in your agent instead of using it as an interactive command.

### Prompt fallback

If your agent cannot load skills, paste [`prompts/vault-init.md`](./prompts/vault-init.md) as the first message in the directory that should become the vault, and answer the agent's domain questions.

## Documentation

- [`docs/llm-wiki.md`](./docs/llm-wiki.md) — full setup, daily ingest/query/lint workflow, and when to use the wiki vs. a project repo.
- [`docs/example-feature-workflow.md`](./docs/example-feature-workflow.md) — a worked flow: tracking features, a pending list, moving items to done, reopening them, and asking about a feature's options.

## License

MIT
