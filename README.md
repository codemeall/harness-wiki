# Harness Wiki

**MCP-first local tooling to scaffold and maintain an _LLM Wiki_ — a long-lived, agent-maintained markdown knowledge vault.**

You curate sources and ask questions; the agent summarizes, cross-references, files, flags contradictions, and keeps an index and log current. Unlike file-upload RAG, an LLM Wiki compiles knowledge into durable, interlinked pages instead of retrieving chunks from scratch on every query.

> **Companion product.** [`@codemeall/harness-bridge`](https://github.com/codemeall/harness-bridge) tracks the **current in-flight task** in one repo via `.harness/bridge.md`. Harness Wiki tracks the **durable knowledge** around many tasks — research, design rationale, decisions. Use them together: wiki for the *why*, project repos for the *what*, bridge files for the *current work*.

## What you get

`harness-wiki` scaffolds and inspects a vault. The actual ingest/query/lint operations are agent-driven, guided by the schema written into `CLAUDE.md` / `AGENTS.md`.

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

Run directly with `npx` (no install):

```bash
npx -y @codemeall/harness-wiki mcp
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

### MCP (recommended)

Register Harness Wiki as an MCP server in your agent. Example MCP client config:

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
Use harness-wiki to initialize an LLM Wiki vault here.
Name: "knowledge"
Domain: software project
```

**MCP tools**

| Tool | Purpose |
|---|---|
| `vault_init` | Scaffold the vault: creates `raw/`, `wiki/{entities,concepts,sources,syntheses}/`, `CLAUDE.md`, `AGENTS.md`, `wiki/index.md`, `wiki/log.md`. Auto-detects empty dir (standalone vault) vs. existing project (appends a marker-fenced `<!-- harness-wiki:vault-schema -->` block to the host `CLAUDE.md` / `AGENTS.md` without touching other content). Idempotent on re-run via the marker. |
| `vault_status` | Report scaffold state and list files in `raw/` with no matching `wiki/sources/<slug>.md` (pending ingests). |

**MCP prompt:** `wiki_init_prompt` returns the canonical setup/operations prompt (also available as the resource `harness-wiki://prompts/vault-init.md`).

### CLI

```bash
harness-wiki mcp                                              # run the MCP server (stdio)
harness-wiki vault-init --name "knowledge" --domain "software project" [--force]
harness-wiki vault-status
```

From a Git checkout, substitute `node /absolute/path/to/harness-wiki/dist/cli.js` for `harness-wiki`.

### Prompt fallback (no MCP)

If your agent doesn't support MCP, paste [`prompts/vault-init.md`](./prompts/vault-init.md) as the first message in the directory that should become the vault, and answer the agent's domain questions.

## Documentation

- [`docs/llm-wiki.md`](./docs/llm-wiki.md) — full setup, daily ingest/query/lint workflow, and when to use the wiki vs. a project repo.

## License

MIT
