import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const VAULT_MARKER_START = "<!-- harness-wiki:vault-schema -->";
export const VAULT_MARKER_END = "<!-- /harness-wiki:vault-schema -->";

export const VAULT_DIRS = [
  "raw",
  "raw/assets",
  "wiki",
  "wiki/entities",
  "wiki/concepts",
  "wiki/sources",
  "wiki/syntheses"
] as const;

export const VAULT_FILES = {
  claudeMd: "CLAUDE.md",
  agentsMd: "AGENTS.md",
  index: "wiki/index.md",
  log: "wiki/log.md"
} as const;

export interface PairedProject {
  name: string;
  path: string;
  purpose: string;
  status: string;
}

export interface InitVaultOptions {
  cwd: string;
  vaultName: string;
  domain?: string;
  pairedProjects?: PairedProject[];
  force?: boolean;
  today?: string;
}

export interface InitVaultResult {
  cwd: string;
  scenario: "standalone" | "co-located";
  createdDirs: string[];
  createdFiles: string[];
  appendedFiles: string[];
  skippedFiles: string[];
}

export interface VaultStatusResult {
  cwd: string;
  state: "not-a-vault" | "partial" | "complete";
  hasVaultMarker: boolean;
  dirs: Record<string, boolean>;
  files: Record<string, boolean>;
  pendingIngests: string[];
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Normalize an arbitrary string (raw filename stem, wikilink target, page name)
 * to the kebab-case slug the agent uses for wiki page filenames. Keeping this
 * in one place is what lets deterministic tooling (status, doctor) agree with
 * the naming convention the agent follows.
 */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function renderPairedProjectsSection(projects: PairedProject[] | undefined): string {
  if (!projects || projects.length === 0) {
    return [
      "## Paired projects",
      "",
      "_(none yet — add rows here as sibling project repos are spun up.)_",
      "",
      "| Project | Path | Purpose | Status |",
      "|---|---|---|---|"
    ].join("\n");
  }
  const rows = projects.map(
    (p) => `| ${p.name} | \`${p.path}\` | ${p.purpose} | ${p.status} |`
  );
  return [
    "## Paired projects",
    "",
    "| Project | Path | Purpose | Status |",
    "|---|---|---|---|",
    ...rows
  ].join("\n");
}

/**
 * SPEC SYNC: the ingest/query/lint operations described in this generated
 * schema are also stated, standalone, in `skills/harness-wiki/SKILL.md` and
 * `prompts/vault-init.md` (each must remain self-contained for its delivery
 * channel). When you change an operation's wording or steps here, mirror it in
 * those two files so the three copies do not drift.
 */
export function renderVaultClaudeMd(opts: {
  vaultName: string;
  domain?: string;
  pairedProjects?: PairedProject[];
}): string {
  const domainLine = opts.domain ? `\n<!-- domain: ${opts.domain} -->\n` : "";
  return `# LLM Wiki Agent — Schema (${opts.vaultName})
${domainLine}
You are the maintainer of this Obsidian-compatible knowledge vault. You write and maintain the wiki; the user curates sources and asks questions.

## Three layers

1. **\`raw/\`** — immutable source documents (articles, PDFs, transcripts, notes). You READ from here, never modify. Assets (images) live in \`raw/assets/\`.
2. **\`wiki/\`** — markdown pages YOU own and maintain. Subfolders:
   - \`wiki/entities/\` — people, organizations, products, places (one page per entity)
   - \`wiki/concepts/\` — ideas, theories, frameworks, methods
   - \`wiki/sources/\` — one summary page per ingested raw source
   - \`wiki/syntheses/\` — comparisons, analyses, thesis pages, query results worth keeping
3. **\`CLAUDE.md\` / \`AGENTS.md\`** — this schema. Co-evolves with the user.

## Core files

- **\`wiki/index.md\`** — catalog of every page, grouped by category, with one-line summaries. Update on every ingest.
- **\`wiki/log.md\`** — append-only chronological record. Each entry MUST start with \`## [YYYY-MM-DD] <op> | <title>\` so it's greppable. Ops: \`ingest\`, \`query\`, \`lint\`, \`schema\`.

## Page conventions

- Filenames: kebab-case (\`elon-musk.md\`, \`prospect-theory.md\`). Use the exact filename as the wiki link target.
- Every page begins with YAML frontmatter:
  \`\`\`yaml
  ---
  type: entity | concept | source | synthesis
  created: YYYY-MM-DD
  updated: YYYY-MM-DD
  sources: [source-slug-1, source-slug-2]
  tags: [tag1, tag2]
  ---
  \`\`\`
- Use \`[[wikilinks]]\` liberally — link any entity/concept mention to its page. Create stub pages for important new mentions rather than leaving dead links.
- Cite claims inline with \`[[sources/source-slug]]\`. Every non-obvious claim should be traceable to a source.
- When sources contradict, surface it explicitly in a **Contradictions** section on the affected page — don't silently pick one.

## Operations

### Ingest (\`ingest <path-or-url>\`)
1. Read the source end-to-end. For a URL, first save the fetched content into \`raw/\` (text as \`raw/<slug>.md\`, images into \`raw/assets/\`) so the source is captured immutably, then ingest that file. Never ingest a URL without persisting it to \`raw/\`.
2. Briefly discuss key takeaways with the user before writing — surface anything surprising, contradictory, or worth emphasizing.
3. Write \`wiki/sources/<slug>.md\` with: metadata, 3-10 bullet key takeaways, notable quotes, open questions. Derive \`<slug>\` from the raw filename in kebab-case (\`PRD Checkout V2.pdf\` → \`prd-checkout-v2.md\`) so tooling can pair the source page with its raw file.
4. Update or create relevant \`entities/\` and \`concepts/\` pages — integrate new info, flag contradictions with existing claims.
5. Update \`wiki/index.md\`.
6. Append entry to \`wiki/log.md\`: \`## [DATE] ingest | <title>\` + 2-3 line summary of what changed.
7. Record the source hash: run \`vault_stamp\` (or, without MCP, write \`source_file\` + \`source_sha256\` into the source page frontmatter). This lets \`vault_doctor\` later detect when the raw file changes (a stale page). Re-run \`vault_stamp\` to acknowledge a legitimate re-review.

### Query (\`<any question>\`)
1. Read \`wiki/index.md\` first to find relevant pages.
2. Drill into those pages, follow \`[[wikilinks]]\` as needed.
3. Answer with inline citations to wiki pages and ultimately to sources.
4. If the answer is substantive (comparison, analysis, novel synthesis), offer to file it as \`wiki/syntheses/<slug>.md\` so the insight compounds.
5. Log non-trivial queries.

### Lint (\`lint\`)
Health-check the wiki. Start with the mechanical pass — run \`vault_doctor\` (or grep \`wiki/\` if MCP is unavailable) for missing frontmatter, dead \`[[wikilinks]]\`, orphan pages, pages absent from the index, **stale source pages** (raw file changed since ingest), and **broken paired-project paths**. Then add judgment-based findings:
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
- Never invent facts. If sources don't cover something, say so explicitly (a \`## Gaps\` section is fine).
- Keep \`updated:\` frontmatter current whenever you touch a page.
- The user reads the wiki in Obsidian; favor formatting that renders well there.

${renderPairedProjectsSection(opts.pairedProjects)}

### Registering a paired project
When a new sibling repo should be fed by this vault, run \`vault_link\` (name, path, purpose, status). It updates the table above **and** writes a marker-fenced back-pointer into the project's \`CLAUDE.md\`, so the link is discoverable from both sides. Re-run it to update a row. \`vault_doctor\` flags rows whose path no longer exists.

### The handoff: synthesis → spec → implementation
The vault holds the **why** (rationale, research, decisions); the project repo holds the **what** (code, shipped docs). When a \`wiki/syntheses/*\` design is approved, hand it off — create or update the spec in the paired repo and begin implementation there, not in the vault. For a long-running implementation session, use Harness Bridge in that repo to track the **current work**.

### When a session is asked to work on a paired project
1. Read the relevant \`wiki/syntheses/*\` pages and related concepts for design context.
2. Switch context to the project repo (\`cd <path>\` shown above).
3. From there, operate per the project's own \`CLAUDE.md\` / \`AGENTS.md\` — the project's instructions take over.
4. When substantive design decisions or learnings emerge during the work, reflect them back into the vault's relevant \`wiki/concepts/\` or \`wiki/syntheses/\` pages before finishing. Append a \`## [YYYY-MM-DD] feature | <title>\` entry to \`wiki/log.md\` recording the change.

## Workflow

The user keeps Obsidian open while you work. After each operation, give a short summary of pages touched so they can browse the changes. Don't ask for confirmation on routine bookkeeping (index/log updates) — just do it.
`;
}

export function renderVaultAgentsMd(): string {
  return "See `CLAUDE.md` for the LLM Wiki schema and operations.\n";
}

export function renderVaultIndexMd(vaultName: string): string {
  return `# ${vaultName} — Index

Catalog of every wiki page, grouped by category. Updated on every ingest.

## Entities

_(none yet)_

## Concepts

_(none yet)_

## Sources

_(none yet)_

## Syntheses

_(none yet)_
`;
}

export function renderVaultLogMd(date: string): string {
  return `# Log

Append-only chronological record. Each entry starts with \`## [YYYY-MM-DD] <op> | <title>\` so it's greppable.

## [${date}] schema | Vault initialized
- Created folder structure and schema files.
- Ready for first ingest.
`;
}

function fencedVaultSchema(claudeBody: string): string {
  return `${VAULT_MARKER_START}\n${claudeBody.trimEnd()}\n${VAULT_MARKER_END}\n`;
}

function fencedAgentsSchema(): string {
  return `${VAULT_MARKER_START}\n${renderVaultAgentsMd().trimEnd()}\n${VAULT_MARKER_END}\n`;
}

function fileExists(p: string): boolean {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function readFileSafe(p: string): string {
  return fileExists(p) ? fs.readFileSync(p, "utf8") : "";
}

function applyFenced(target: string, fenced: string): "created" | "appended" | "skipped" {
  if (!fileExists(target)) {
    fs.writeFileSync(target, fenced, "utf8");
    return "created";
  }
  const existing = readFileSafe(target);
  if (existing.trim().length === 0) {
    fs.writeFileSync(target, fenced, "utf8");
    return "created";
  }
  if (existing.includes(VAULT_MARKER_START)) {
    return "skipped";
  }
  const separator = existing.endsWith("\n") ? "\n" : "\n\n";
  fs.writeFileSync(target, `${existing}${separator}${fenced}`, "utf8");
  return "appended";
}

export function initVault(options: InitVaultOptions): InitVaultResult {
  const { cwd, vaultName, domain, pairedProjects, force = false } = options;
  const date = options.today ?? today();

  const wikiDir = path.join(cwd, "wiki");
  const claudePath = path.join(cwd, VAULT_FILES.claudeMd);
  const agentsPath = path.join(cwd, VAULT_FILES.agentsMd);

  const claudeExisting = readFileSafe(claudePath);
  const claudeHasMarker = claudeExisting.includes(VAULT_MARKER_START);

  if (!force) {
    if (fileExists(wikiDir)) {
      throw new Error(
        `Refusing to init vault: ${wikiDir} already exists. Pass force=true to override.`
      );
    }
    if (claudeHasMarker) {
      throw new Error(
        `Refusing to init vault: ${claudePath} already contains the vault marker. Pass force=true to override.`
      );
    }
  }

  const createdDirs: string[] = [];
  for (const dir of VAULT_DIRS) {
    const abs = path.join(cwd, dir);
    if (!fileExists(abs)) {
      fs.mkdirSync(abs, { recursive: true });
      createdDirs.push(dir);
    }
  }

  const createdFiles: string[] = [];
  const appendedFiles: string[] = [];
  const skippedFiles: string[] = [];

  const claudeBody = renderVaultClaudeMd({ vaultName, domain, pairedProjects });
  const fencedClaude = fencedVaultSchema(claudeBody);
  const fencedAgents = fencedAgentsSchema();

  const scenario: "standalone" | "co-located" = fileExists(claudePath) ? "co-located" : "standalone";

  const claudeAction = applyFenced(claudePath, fencedClaude);
  if (claudeAction === "created") createdFiles.push(VAULT_FILES.claudeMd);
  else if (claudeAction === "appended") appendedFiles.push(VAULT_FILES.claudeMd);
  else skippedFiles.push(VAULT_FILES.claudeMd);

  const agentsAction = applyFenced(agentsPath, fencedAgents);
  if (agentsAction === "created") createdFiles.push(VAULT_FILES.agentsMd);
  else if (agentsAction === "appended") appendedFiles.push(VAULT_FILES.agentsMd);
  else skippedFiles.push(VAULT_FILES.agentsMd);

  const indexPath = path.join(cwd, VAULT_FILES.index);
  if (!fileExists(indexPath)) {
    fs.writeFileSync(indexPath, renderVaultIndexMd(vaultName), "utf8");
    createdFiles.push(VAULT_FILES.index);
  } else {
    skippedFiles.push(VAULT_FILES.index);
  }

  const logPath = path.join(cwd, VAULT_FILES.log);
  if (!fileExists(logPath)) {
    fs.writeFileSync(logPath, renderVaultLogMd(date), "utf8");
    createdFiles.push(VAULT_FILES.log);
  } else {
    skippedFiles.push(VAULT_FILES.log);
  }

  return {
    cwd,
    scenario,
    createdDirs,
    createdFiles,
    appendedFiles,
    skippedFiles
  };
}

function listPendingIngests(cwd: string): string[] {
  const rawDir = path.join(cwd, "raw");
  const sourcesDir = path.join(cwd, "wiki", "sources");
  if (!fileExists(rawDir)) return [];

  const ingestedSlugs = new Set<string>();
  if (fileExists(sourcesDir)) {
    for (const entry of fs.readdirSync(sourcesDir)) {
      if (entry.endsWith(".md")) {
        // Match on the normalized slug so a raw file named "PRD Checkout V2.pdf"
        // is recognized as ingested by its source page "prd-checkout-v2.md".
        ingestedSlugs.add(slugify(entry.replace(/\.md$/, "")));
      }
    }
  }

  const pending: string[] = [];
  const walk = (dir: string, rel: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      const relPath = path.join(rel, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "assets") continue;
        walk(abs, relPath);
        continue;
      }
      if (!entry.isFile()) continue;
      const slug = slugify(entry.name.replace(/\.[^.]+$/, ""));
      if (!ingestedSlugs.has(slug)) {
        pending.push(relPath);
      }
    }
  };
  walk(rawDir, "raw");
  return pending.sort();
}

export function vaultStatus(cwd: string): VaultStatusResult {
  const dirs: Record<string, boolean> = {};
  for (const dir of VAULT_DIRS) {
    dirs[dir] = fileExists(path.join(cwd, dir));
  }
  const files: Record<string, boolean> = {};
  for (const [key, rel] of Object.entries(VAULT_FILES)) {
    files[key] = fileExists(path.join(cwd, rel));
  }

  const claudeContent = readFileSafe(path.join(cwd, VAULT_FILES.claudeMd));
  const hasVaultMarker = claudeContent.includes(VAULT_MARKER_START);

  const allDirs = Object.values(dirs).every(Boolean);
  const allFiles = Object.values(files).every(Boolean);
  const noneDirs = Object.values(dirs).every((v) => !v);
  const noneFiles = Object.values(files).every((v) => !v);

  let state: VaultStatusResult["state"];
  if (allDirs && allFiles && hasVaultMarker) {
    state = "complete";
  } else if (noneDirs && noneFiles && !hasVaultMarker) {
    state = "not-a-vault";
  } else {
    state = "partial";
  }

  return {
    cwd,
    state,
    hasVaultMarker,
    dirs,
    files,
    pendingIngests: listPendingIngests(cwd)
  };
}

// ---------------------------------------------------------------------------
// vault_doctor — deterministic structural health check
// ---------------------------------------------------------------------------

export interface WikiPage {
  /** Path relative to the vault root, e.g. "wiki/entities/alice.md". */
  relPath: string;
  /** Path relative to wiki/ without extension, e.g. "entities/alice". */
  wikiPath: string;
  /** Filename stem, e.g. "alice". */
  slug: string;
  content: string;
}

export interface VaultDoctorResult {
  cwd: string;
  pageCount: number;
  missingFrontmatter: string[];
  deadLinks: { page: string; target: string }[];
  orphanPages: string[];
  notInIndex: string[];
  /** Source pages whose raw file changed since the recorded source_sha256. */
  staleSources: string[];
  /** Source pages with no recorded source_sha256 (run vault_stamp). */
  unhashedSources: string[];
  /** Source pages whose paired raw file no longer exists. */
  missingRawSources: string[];
  /** Paired-projects rows whose path does not exist on disk. */
  brokenPairedProjects: { name: string; path: string }[];
  ok: boolean;
}

const FRONTMATTER_RE = /^---\r?\n[\s\S]*?\r?\n---/;
const WIKILINK_RE = /\[\[([^\]]+)\]\]/g;

/** Parse top-level scalar `key: value` lines from a page's YAML frontmatter. */
function parseFrontmatter(content: string): Record<string, string> {
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  const data: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (kv) data[kv[1]] = kv[2].trim();
  }
  return data;
}

/** Update or insert scalar keys in a page's frontmatter, creating one if absent. */
function setFrontmatterKeys(content: string, updates: Record<string, string>): string {
  const m = content.match(/^(---\r?\n)([\s\S]*?)(\r?\n---)/);
  if (!m) {
    const block = Object.entries(updates)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");
    return `---\n${block}\n---\n\n${content}`;
  }
  const lines = m[2].split(/\r?\n/);
  const remaining = { ...updates };
  const out = lines.map((line) => {
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (kv && kv[1] in remaining) {
      const newLine = `${kv[1]}: ${remaining[kv[1]]}`;
      delete remaining[kv[1]];
      return newLine;
    }
    return line;
  });
  for (const [k, v] of Object.entries(remaining)) out.push(`${k}: ${v}`);
  return content.slice(0, m.index! + m[1].length) + out.join("\n") + content.slice(m.index! + m[1].length + m[2].length);
}

function sha256(buf: Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

/** Map slugified raw filename stem → raw-relative path (e.g. "raw/notes.md"). */
function rawFileIndex(cwd: string): Map<string, string> {
  const rawDir = path.join(cwd, "raw");
  const index = new Map<string, string>();
  if (!fileExists(rawDir)) return index;
  const walk = (dir: string, rel: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      const relPath = path.join(rel, entry.name).split(path.sep).join("/");
      if (entry.isDirectory()) {
        if (entry.name === "assets") continue;
        walk(abs, relPath);
        continue;
      }
      if (!entry.isFile()) continue;
      index.set(slugify(entry.name.replace(/\.[^.]+$/, "")), relPath);
    }
  };
  walk(rawDir, "raw");
  return index;
}

function collectWikiPages(cwd: string): WikiPage[] {
  const wikiDir = path.join(cwd, "wiki");
  if (!fileExists(wikiDir)) return [];
  const pages: WikiPage[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(abs);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
      const relPath = path.relative(cwd, abs).split(path.sep).join("/");
      const wikiRel = path.relative(wikiDir, abs).split(path.sep).join("/").replace(/\.md$/, "");
      // index.md and log.md are catalogs, not content pages.
      if (wikiRel === "index" || wikiRel === "log") continue;
      pages.push({
        relPath,
        wikiPath: wikiRel,
        slug: path.basename(abs).replace(/\.md$/, ""),
        content: fs.readFileSync(abs, "utf8")
      });
    }
  };
  walk(wikiDir);
  return pages.sort((a, b) => a.relPath.localeCompare(b.relPath));
}

/** Normalize a wikilink target: drop alias (`|...`) and anchor (`#...`), trim. */
function normalizeLinkTarget(raw: string): string {
  return raw.split("|")[0].split("#")[0].trim();
}

function extractWikilinks(content: string): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  WIKILINK_RE.lastIndex = 0;
  while ((m = WIKILINK_RE.exec(content)) !== null) {
    const target = normalizeLinkTarget(m[1]);
    if (target) out.push(target);
  }
  return out;
}

export function vaultDoctor(cwd: string): VaultDoctorResult {
  const pages = collectWikiPages(cwd);

  // Resolution table: a link resolves if it matches a full wiki-relative path
  // (e.g. "entities/alice") or a bare slug (e.g. "alice"), in slug form.
  const byWikiPath = new Set(pages.map((p) => slugify(p.wikiPath.replace(/\//g, " "))));
  const bySlug = new Set(pages.map((p) => slugify(p.slug)));
  const resolves = (target: string): boolean => {
    const asPath = slugify(target.replace(/\//g, " "));
    const asSlug = slugify(target.split("/").pop() ?? target);
    return byWikiPath.has(asPath) || bySlug.has(asSlug);
  };

  const missingFrontmatter: string[] = [];
  const deadLinks: { page: string; target: string }[] = [];
  const inboundFor = new Set<string>();

  for (const page of pages) {
    if (!FRONTMATTER_RE.test(page.content)) missingFrontmatter.push(page.relPath);
    for (const target of extractWikilinks(page.content)) {
      if (resolves(target)) {
        inboundFor.add(slugify(target.split("/").pop() ?? target));
      } else {
        deadLinks.push({ page: page.relPath, target });
      }
    }
  }

  // index.md text is also a source of inbound references — a page listed in the
  // catalog is not an orphan even if no content page links to it yet.
  const indexContent = readFileSafe(path.join(cwd, VAULT_FILES.index));
  for (const target of extractWikilinks(indexContent)) {
    inboundFor.add(slugify(target.split("/").pop() ?? target));
  }
  const indexSlugs = new Set(
    extractWikilinks(indexContent).map((t) => slugify(t.split("/").pop() ?? t))
  );

  const orphanPages = pages
    .filter((p) => !inboundFor.has(slugify(p.slug)))
    .map((p) => p.relPath);
  const notInIndex = pages.filter((p) => !indexSlugs.has(slugify(p.slug))).map((p) => p.relPath);

  // Source-hash staleness: compare each source page's recorded source_sha256
  // against the current hash of its paired raw file.
  const rawIndex = rawFileIndex(cwd);
  const staleSources: string[] = [];
  const unhashedSources: string[] = [];
  const missingRawSources: string[] = [];
  for (const page of pages) {
    if (!page.wikiPath.startsWith("sources/")) continue;
    const fm = parseFrontmatter(page.content);
    const rawRel = fm.source_file || rawIndex.get(slugify(page.slug));
    if (!rawRel) {
      missingRawSources.push(page.relPath);
      continue;
    }
    const rawAbs = path.join(cwd, rawRel);
    if (!fileExists(rawAbs)) {
      missingRawSources.push(page.relPath);
      continue;
    }
    if (!fm.source_sha256) {
      unhashedSources.push(page.relPath);
      continue;
    }
    if (sha256(fs.readFileSync(rawAbs)) !== fm.source_sha256) {
      staleSources.push(page.relPath);
    }
  }

  // Paired-projects rows whose path does not exist on disk.
  const brokenPairedProjects = pairedProjectsFromClaude(cwd).filter(
    (p) => !fileExists(path.resolve(cwd, p.path))
  );

  return {
    cwd,
    pageCount: pages.length,
    missingFrontmatter,
    deadLinks,
    orphanPages,
    notInIndex,
    staleSources,
    unhashedSources,
    missingRawSources,
    brokenPairedProjects,
    ok:
      missingFrontmatter.length === 0 &&
      deadLinks.length === 0 &&
      orphanPages.length === 0 &&
      notInIndex.length === 0 &&
      staleSources.length === 0 &&
      missingRawSources.length === 0 &&
      brokenPairedProjects.length === 0
  };
}

// ---------------------------------------------------------------------------
// vault_search — plain-text search across wiki pages (no embeddings, no deps)
// ---------------------------------------------------------------------------

export interface SearchHit {
  file: string;
  line: number;
  text: string;
}

export interface VaultSearchResult {
  cwd: string;
  query: string;
  hitCount: number;
  hits: SearchHit[];
}

export function vaultSearch(cwd: string, query: string, limit = 50): VaultSearchResult {
  const pages = collectWikiPages(cwd);
  const needle = query.toLowerCase();
  const hits: SearchHit[] = [];
  for (const page of pages) {
    const lines = page.content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(needle)) {
        hits.push({ file: page.relPath, line: i + 1, text: lines[i].trim() });
        if (hits.length >= limit) {
          return { cwd, query, hitCount: hits.length, hits };
        }
      }
    }
  }
  return { cwd, query, hitCount: hits.length, hits };
}

// ---------------------------------------------------------------------------
// vault_stamp — record source-file hashes into source-page frontmatter
// ---------------------------------------------------------------------------

export interface StampResult {
  cwd: string;
  stamped: { page: string; source: string; sha256: string }[];
  unmatched: string[];
}

/**
 * For each wiki/sources/*.md page, find its paired raw file (by explicit
 * `source_file` frontmatter, else by slug) and write `source_file` +
 * `source_sha256` into the page's frontmatter. Run after an ingest, and again
 * to acknowledge a re-review after a source legitimately changed.
 */
export function stampSources(cwd: string): StampResult {
  const sourcesDir = path.join(cwd, "wiki", "sources");
  const rawIndex = rawFileIndex(cwd);
  const stamped: StampResult["stamped"] = [];
  const unmatched: string[] = [];
  if (!fileExists(sourcesDir)) return { cwd, stamped, unmatched };

  for (const entry of fs.readdirSync(sourcesDir)) {
    if (!entry.endsWith(".md")) continue;
    const pageAbs = path.join(sourcesDir, entry);
    const relPage = `wiki/sources/${entry}`;
    const content = fs.readFileSync(pageAbs, "utf8");
    const fm = parseFrontmatter(content);
    const slug = slugify(entry.replace(/\.md$/, ""));
    const rawRel = fm.source_file || rawIndex.get(slug);
    if (!rawRel || !fileExists(path.join(cwd, rawRel))) {
      unmatched.push(relPage);
      continue;
    }
    const sha = sha256(fs.readFileSync(path.join(cwd, rawRel)));
    const updated = setFrontmatterKeys(content, { source_file: rawRel, source_sha256: sha });
    if (updated !== content) fs.writeFileSync(pageAbs, updated, "utf8");
    stamped.push({ page: relPage, source: rawRel, sha256: sha });
  }
  return { cwd, stamped, unmatched };
}

// ---------------------------------------------------------------------------
// vault_link — register a paired project (the wiki ↔ repo wedge)
// ---------------------------------------------------------------------------

const BACKLINK_START = "<!-- harness-wiki:vault-backlink -->";
const BACKLINK_END = "<!-- /harness-wiki:vault-backlink -->";

/** Read the Paired-projects table rows out of the vault's CLAUDE.md. */
export function pairedProjectsFromClaude(cwd: string): PairedProject[] {
  const content = readFileSafe(path.join(cwd, VAULT_FILES.claudeMd));
  const after = content.split(/^##\s+Paired projects\s*$/m)[1];
  if (!after) return [];
  // Bound to the rows between the heading and the next "### " or "## " heading
  // so we never pick up tables from later sections.
  const section = after.split(/^#{2,3}\s/m)[0];
  const rows: PairedProject[] = [];
  for (const line of section.split(/\r?\n/)) {
    const cells = line.split("|").map((c) => c.trim());
    // A data row is `| name | `path` | purpose | status |` → 6 cells incl. edges.
    if (cells.length < 6) continue;
    const [, name, rawPath, purpose, status] = cells;
    if (!name || name === "Project" || /^-+$/.test(name)) continue;
    rows.push({ name, path: rawPath.replace(/`/g, ""), purpose, status });
  }
  return rows;
}

export interface LinkProjectResult {
  cwd: string;
  project: PairedProject;
  action: "added" | "updated";
  backlinkWritten: boolean;
  backlinkTarget?: string;
}

/**
 * Register (or update) a sibling project in the vault's Paired-projects table,
 * and write a marker-fenced back-pointer into the sibling repo's CLAUDE.md so
 * discovery is bidirectional. Idempotent on both sides.
 */
export function linkProject(cwd: string, project: PairedProject, vaultName: string): LinkProjectResult {
  const claudePath = path.join(cwd, VAULT_FILES.claudeMd);
  const content = readFileSafe(claudePath);
  if (!content) {
    throw new Error(`No CLAUDE.md at ${cwd}. Initialize the vault first.`);
  }

  const existing = pairedProjectsFromClaude(cwd);
  const known = new Map(existing.map((p) => [p.name, p]));
  const action: "added" | "updated" = known.has(project.name) ? "updated" : "added";
  known.set(project.name, project);

  const table = [
    "| Project | Path | Purpose | Status |",
    "|---|---|---|---|",
    ...[...known.values()].map((p) => `| ${p.name} | \`${p.path}\` | ${p.purpose} | ${p.status} |`)
  ].join("\n");

  // Replace from the "## Paired projects" heading up to the next heading of any
  // level (e.g. "### When a session…") or the schema end-marker, keeping the
  // table fresh without disturbing the surrounding sections.
  const newSection = `## Paired projects\n\n${table}\n\n`;
  const headingRe = /^##\s+Paired projects\b[\s\S]*?(?=^#{2,}\s|^<!-- \/harness-wiki:vault-schema -->|$(?![\s\S]))/m;
  const next = headingRe.test(content)
    ? content.replace(headingRe, newSection)
    : `${content.trimEnd()}\n\n${newSection}`;
  fs.writeFileSync(claudePath, next, "utf8");

  // Write a back-pointer into the sibling repo's CLAUDE.md if it resolves.
  let backlinkWritten = false;
  let backlinkTarget: string | undefined;
  const projAbs = path.resolve(cwd, project.path);
  if (fileExists(projAbs)) {
    const projClaude = path.join(projAbs, "CLAUDE.md");
    backlinkTarget = projClaude;
    const block = [
      BACKLINK_START,
      `## Knowledge vault`,
      ``,
      `This project's design rationale, research, and decisions live in the **${vaultName}** Harness Wiki vault at \`${path.relative(projAbs, cwd) || "."}\`.`,
      `Read its \`wiki/syntheses/\` and \`wiki/concepts/\` pages for design context before changing behavior, and reflect substantive new decisions back into the vault.`,
      BACKLINK_END,
      ""
    ].join("\n");
    const prev = readFileSafe(projClaude);
    if (prev.includes(BACKLINK_START)) {
      const re = new RegExp(`${BACKLINK_START}[\\s\\S]*?${BACKLINK_END}\\n?`);
      fs.writeFileSync(projClaude, prev.replace(re, block), "utf8");
    } else {
      const sep = prev.trim().length ? `${prev.trimEnd()}\n\n` : "";
      fs.writeFileSync(projClaude, `${sep}${block}`, "utf8");
    }
    backlinkWritten = true;
  }

  return { cwd, project, action, backlinkWritten, backlinkTarget };
}
