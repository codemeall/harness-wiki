import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { initVault, vaultStatus, vaultDoctor, vaultSearch, stampSources, linkProject } from "../core/vault.js";
import { PACKAGE_VERSION } from "../core/version.js";
import fs from "node:fs";
import path from "node:path";

const VAULT_INIT_PROMPT_FILE = "vault-init.md";
const PROMPT_DIR = new URL("../../prompts/", import.meta.url);

function textResponse(text: string) {
  return {
    content: [
      {
        type: "text" as const,
        text
      }
    ]
  };
}

function jsonResponse(value: unknown) {
  return textResponse(JSON.stringify(value, null, 2));
}

function readVaultInitPrompt(): string {
  return fs.readFileSync(new URL(VAULT_INIT_PROMPT_FILE, PROMPT_DIR), "utf8");
}

function resolveToolCwd(serverCwd: string, toolCwd: string | undefined): string {
  return toolCwd ? path.resolve(serverCwd, toolCwd) : serverCwd;
}

export function createHarnessWikiServer(cwd = process.cwd()): McpServer {
  const server = new McpServer(
    {
      name: "harness-wiki",
      version: PACKAGE_VERSION
    },
    {
      instructions:
        "Use Harness Wiki tools to scaffold and maintain an LLM Wiki — an Obsidian-compatible markdown knowledge vault the agent owns. Call vault_init to create the vault scaffold and vault_status to inspect it. Always pass the target workspace absolute path as cwd when the agent knows it; otherwise the tool falls back to the MCP server process directory. Fetch the canonical setup/operations prompt via the wiki_init_prompt MCP prompt."
    }
  );

  const promptUri = `harness-wiki://prompts/${VAULT_INIT_PROMPT_FILE}`;
  server.registerResource(
    "prompt-vault-init",
    promptUri,
    {
      title: "Harness Wiki vault-init prompt",
      description: `Canonical prompt file prompts/${VAULT_INIT_PROMPT_FILE}.`,
      mimeType: "text/markdown"
    },
    async () => ({
      contents: [
        {
          uri: promptUri,
          mimeType: "text/markdown",
          text: readVaultInitPrompt()
        }
      ]
    })
  );

  server.registerPrompt(
    "wiki_init_prompt",
    {
      title: "Harness Wiki vault-init",
      description: `Return the canonical prompts/${VAULT_INIT_PROMPT_FILE} text.`
    },
    async () => ({
      description: `Harness Wiki vault-init prompt from prompts/${VAULT_INIT_PROMPT_FILE}.`,
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: readVaultInitPrompt()
          }
        }
      ]
    })
  );

  server.tool(
    "vault_init",
    "Scaffold an LLM Wiki / second-brain vault in the target directory: creates raw/, wiki/{entities,concepts,sources,syntheses}/, CLAUDE.md, AGENTS.md, wiki/index.md, wiki/log.md. Works in an empty dir (standalone vault) or alongside an existing project (appends a marker-fenced vault schema to the host CLAUDE.md/AGENTS.md). Idempotent on the schema-append path. Pass cwd as the workspace absolute path to avoid initializing the MCP server launch directory.",
    {
      cwd: z
        .string()
        .optional()
        .describe("Target vault/workspace directory. Prefer an absolute path. Defaults to the MCP server process cwd when omitted."),
      vaultName: z.string().describe("Display name for the vault (used in CLAUDE.md heading and wiki/index.md)."),
      domain: z
        .string()
        .optional()
        .describe("Optional domain hint (e.g. 'software project', 'research', 'personal'). Recorded as a comment in CLAUDE.md."),
      pairedProjects: z
        .array(
          z.object({
            name: z.string(),
            path: z.string(),
            purpose: z.string(),
            status: z.string()
          })
        )
        .optional()
        .describe("Optional sibling project repos to register in the Paired projects table."),
      force: z
        .boolean()
        .default(false)
        .describe("Override vault-specific collisions (existing wiki/ or vault-marked CLAUDE.md). Does not touch unrelated host-project files.")
    },
    async ({ cwd: toolCwd, vaultName, domain, pairedProjects, force }) => {
      const result = initVault({
        cwd: resolveToolCwd(cwd, toolCwd),
        vaultName,
        domain,
        pairedProjects,
        force
      });
      const lines: string[] = [
        `Vault initialized (${result.scenario}) at ${result.cwd}.`,
        ""
      ];
      if (result.createdDirs.length) {
        lines.push("Created directories:", ...result.createdDirs.map((d) => `  - ${d}/`), "");
      }
      if (result.createdFiles.length) {
        lines.push("Created files:", ...result.createdFiles.map((f) => `  - ${f}`), "");
      }
      if (result.appendedFiles.length) {
        lines.push("Appended vault schema to:", ...result.appendedFiles.map((f) => `  - ${f}`), "");
      }
      if (result.skippedFiles.length) {
        lines.push("Skipped (already vault-marked or present):", ...result.skippedFiles.map((f) => `  - ${f}`), "");
      }
      lines.push(
        "Next: drop source documents into raw/ and tell the agent `ingest raw/<file>` (or `ingest <url>`). The agent follows the schema in CLAUDE.md to summarize and integrate them into the wiki. Fetch the canonical operations prompt via the `wiki_init_prompt` MCP prompt if needed."
      );
      return textResponse(lines.join("\n"));
    }
  );

  server.tool(
    "vault_status",
    "Report vault scaffold state in the target directory: which expected dirs/files exist, whether CLAUDE.md carries the vault marker, and which files in raw/ have no matching wiki/sources/<slug>.md (pending ingests). Pass cwd as the workspace absolute path to avoid inspecting the MCP server launch directory.",
    {
      cwd: z
        .string()
        .optional()
        .describe("Target vault/workspace directory. Prefer an absolute path. Defaults to the MCP server process cwd when omitted.")
    },
    async ({ cwd: toolCwd }) => jsonResponse(vaultStatus(resolveToolCwd(cwd, toolCwd)))
  );

  server.tool(
    "vault_doctor",
    "Run a deterministic structural health check on the vault: pages missing YAML frontmatter, dead [[wikilinks]] that resolve to no page, orphan pages with no inbound links, and pages absent from wiki/index.md. Complements the agent-driven `lint` operation (which reasons about contradictions and stale claims) with cheap mechanical checks. Pass cwd as the workspace absolute path.",
    {
      cwd: z
        .string()
        .optional()
        .describe("Target vault/workspace directory. Prefer an absolute path. Defaults to the MCP server process cwd when omitted.")
    },
    async ({ cwd: toolCwd }) => jsonResponse(vaultDoctor(resolveToolCwd(cwd, toolCwd)))
  );

  server.tool(
    "vault_search",
    "Plain-text search across all wiki/ pages (case-insensitive substring match over page content and frontmatter). Returns file + line + matching text. Use to locate relevant pages before a query when the vault is large enough that reading wiki/index.md alone is not enough. Pass cwd as the workspace absolute path.",
    {
      cwd: z
        .string()
        .optional()
        .describe("Target vault/workspace directory. Prefer an absolute path. Defaults to the MCP server process cwd when omitted."),
      query: z.string().describe("Text to search for across wiki pages."),
      limit: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Max number of matching lines to return (default 50).")
    },
    async ({ cwd: toolCwd, query, limit }) =>
      jsonResponse(vaultSearch(resolveToolCwd(cwd, toolCwd), query, limit))
  );

  server.tool(
    "vault_stamp",
    "Record source-file hashes into wiki/sources/*.md frontmatter (source_file + source_sha256). Run this right after an ingest so vault_doctor can later detect when a raw source file has changed (stale), and run it again to acknowledge a re-review after a source legitimately changed. Pass cwd as the workspace absolute path.",
    {
      cwd: z
        .string()
        .optional()
        .describe("Target vault/workspace directory. Prefer an absolute path. Defaults to the MCP server process cwd when omitted.")
    },
    async ({ cwd: toolCwd }) => jsonResponse(stampSources(resolveToolCwd(cwd, toolCwd)))
  );

  server.tool(
    "vault_link",
    "Register (or update) a sibling project repo in the vault's Paired-projects table, and write a marker-fenced back-pointer into that repo's CLAUDE.md so the link is discoverable from both sides. This is the wiki↔repo wedge: the vault holds the why, the project holds the what. Idempotent. Pass cwd as the vault's absolute path; path is the project location relative to the vault (or absolute).",
    {
      cwd: z
        .string()
        .optional()
        .describe("Vault directory (must already be initialized). Prefer an absolute path."),
      name: z.string().describe("Project name (table key; re-linking the same name updates the row)."),
      path: z.string().describe("Project location relative to the vault (e.g. '../my-app/') or absolute."),
      purpose: z.string().describe("One-line description of what the project ships."),
      status: z.string().describe("Lifecycle status, e.g. 'design', 'building', 'shipped'."),
      vaultName: z
        .string()
        .optional()
        .describe("Vault display name used in the back-pointer text. Defaults to 'knowledge'.")
    },
    async ({ cwd: toolCwd, name, path: projPath, purpose, status, vaultName }) =>
      jsonResponse(
        linkProject(
          resolveToolCwd(cwd, toolCwd),
          { name, path: projPath, purpose, status },
          vaultName ?? "knowledge"
        )
      )
  );

  return server;
}

export async function runMcpServer(cwd = process.cwd()): Promise<void> {
  const server = createHarnessWikiServer(cwd);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
