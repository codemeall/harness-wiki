import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("vault core", () => {
  let vaultDir: string;

  beforeEach(() => {
    vaultDir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-wiki-test-"));
  });

  afterEach(() => {
    fs.rmSync(vaultDir, { recursive: true, force: true });
  });

  it("scaffolds a standalone vault in an empty directory", async () => {
    const { initVault, vaultStatus, VAULT_DIRS, VAULT_FILES, VAULT_MARKER_START } = await import(
      "../src/core/vault.js"
    );
    const result = initVault({ cwd: vaultDir, vaultName: "demo" });

    expect(result.scenario).toBe("standalone");
    for (const dir of VAULT_DIRS) {
      expect(fs.existsSync(path.join(vaultDir, dir)), dir).toBe(true);
    }
    for (const rel of Object.values(VAULT_FILES)) {
      expect(fs.existsSync(path.join(vaultDir, rel)), rel).toBe(true);
    }

    const claude = fs.readFileSync(path.join(vaultDir, VAULT_FILES.claudeMd), "utf8");
    expect(claude).toContain("LLM Wiki Agent — Schema (demo)");
    expect(claude).toContain(VAULT_MARKER_START);
    expect(claude).toContain("<!-- harness-wiki:vault-schema -->");

    const log = fs.readFileSync(path.join(vaultDir, VAULT_FILES.log), "utf8");
    expect(log).toMatch(/^## \[\d{4}-\d{2}-\d{2}\] schema \| Vault initialized$/m);

    const status = vaultStatus(vaultDir);
    expect(status.state).toBe("complete");
    expect(status.pendingIngests).toEqual([]);
  });

  it("co-locates with an existing project by appending a marker-fenced section", async () => {
    const { initVault, VAULT_MARKER_START, VAULT_MARKER_END } = await import(
      "../src/core/vault.js"
    );
    const hostClaude = "# My Project\n\nProject-specific instructions.\n";
    fs.writeFileSync(path.join(vaultDir, "CLAUDE.md"), hostClaude, "utf8");
    fs.writeFileSync(path.join(vaultDir, "package.json"), "{}", "utf8");
    fs.mkdirSync(path.join(vaultDir, "src"));

    const result = initVault({ cwd: vaultDir, vaultName: "project-vault" });

    expect(result.scenario).toBe("co-located");
    expect(result.appendedFiles).toContain("CLAUDE.md");

    const claude = fs.readFileSync(path.join(vaultDir, "CLAUDE.md"), "utf8");
    expect(claude.startsWith(hostClaude)).toBe(true);
    expect(claude).toContain(VAULT_MARKER_START);
    expect(claude).toContain(VAULT_MARKER_END);
    expect(claude).toContain("LLM Wiki Agent — Schema (project-vault)");
  });

  it("refuses on wiki/ collision without force", async () => {
    const { initVault } = await import("../src/core/vault.js");
    initVault({ cwd: vaultDir, vaultName: "demo" });
    expect(() => initVault({ cwd: vaultDir, vaultName: "demo" })).toThrow(/already exists/);
  });

  it("force is repair-only: passes the wiki/ collision but never overwrites schema or catalogs", async () => {
    const { initVault } = await import("../src/core/vault.js");
    initVault({ cwd: vaultDir, vaultName: "first" });

    // Simulate agent-written content the user would lose if force overwrote.
    const logPath = path.join(vaultDir, "wiki", "log.md");
    fs.appendFileSync(logPath, "\n## [2026-05-27] ingest | precious entry\n- do not lose this\n", "utf8");
    const beforeLog = fs.readFileSync(logPath, "utf8");
    const indexPath = path.join(vaultDir, "wiki", "index.md");
    fs.appendFileSync(indexPath, "\n- [[entities/alice]] — first entity page\n", "utf8");
    const beforeIndex = fs.readFileSync(indexPath, "utf8");

    const result = initVault({ cwd: vaultDir, vaultName: "second", force: true });

    const claude = fs.readFileSync(path.join(vaultDir, "CLAUDE.md"), "utf8");
    expect(claude).toContain("LLM Wiki Agent — Schema (first)");
    expect(claude).not.toContain("LLM Wiki Agent — Schema (second)");
    expect(result.skippedFiles).toEqual(
      expect.arrayContaining(["CLAUDE.md", "AGENTS.md", "wiki/index.md", "wiki/log.md"])
    );
    expect(fs.readFileSync(logPath, "utf8")).toBe(beforeLog);
    expect(fs.readFileSync(indexPath, "utf8")).toBe(beforeIndex);
  });

  it("vaultStatus marks a directory without the vault marker as not-a-vault even with leftover dirs", async () => {
    const { vaultStatus } = await import("../src/core/vault.js");
    fs.mkdirSync(path.join(vaultDir, "wiki"));
    // No CLAUDE.md, no marker → must not report 'complete'.
    const status = vaultStatus(vaultDir);
    expect(status.state).not.toBe("complete");
    expect(status.hasVaultMarker).toBe(false);
  });

  it("vaultStatus surfaces pending ingests from raw/", async () => {
    const { initVault, vaultStatus } = await import("../src/core/vault.js");
    initVault({ cwd: vaultDir, vaultName: "demo" });
    fs.writeFileSync(path.join(vaultDir, "raw", "alpha.md"), "# alpha\n", "utf8");
    fs.writeFileSync(path.join(vaultDir, "raw", "beta.md"), "# beta\n", "utf8");
    fs.writeFileSync(path.join(vaultDir, "wiki", "sources", "alpha.md"), "---\n---\n", "utf8");

    const status = vaultStatus(vaultDir);
    expect(status.pendingIngests).toEqual(["raw/beta.md"]);
  });

  it("vaultStatus reports not-a-vault on a fresh directory", async () => {
    const { vaultStatus } = await import("../src/core/vault.js");
    const status = vaultStatus(vaultDir);
    expect(status.state).toBe("not-a-vault");
    expect(status.hasVaultMarker).toBe(false);
  });

  it("renders the Paired projects table when provided", async () => {
    const { renderVaultClaudeMd } = await import("../src/core/vault.js");
    const md = renderVaultClaudeMd({
      vaultName: "demo",
      pairedProjects: [
        { name: "harness-bridge", path: "../harness-bridge/", purpose: "AI handoff", status: "v1" }
      ]
    });
    expect(md).toContain("| harness-bridge | `../harness-bridge/` | AI handoff | v1 |");
  });

  it("matches pending ingests by slug, not raw filename (spaces and caps)", async () => {
    const { initVault, vaultStatus } = await import("../src/core/vault.js");
    initVault({ cwd: vaultDir, vaultName: "demo" });
    // Raw file has spaces and caps; its source page is the kebab-case slug.
    fs.writeFileSync(path.join(vaultDir, "raw", "PRD Checkout V2.pdf"), "x", "utf8");
    fs.writeFileSync(path.join(vaultDir, "raw", "Not Yet.md"), "x", "utf8");
    fs.writeFileSync(
      path.join(vaultDir, "wiki", "sources", "prd-checkout-v2.md"),
      "---\n---\n",
      "utf8"
    );

    const status = vaultStatus(vaultDir);
    // The ingested file must NOT appear as pending; only the un-ingested one does.
    expect(status.pendingIngests).toEqual(["raw/Not Yet.md"]);
  });
});

describe("slugify", () => {
  it("normalizes spaces, caps, punctuation, and accents", async () => {
    const { slugify } = await import("../src/core/vault.js");
    expect(slugify("PRD Checkout V2")).toBe("prd-checkout-v2");
    expect(slugify("Élan & Co.")).toBe("elan-co");
    expect(slugify("  Hello__World  ")).toBe("hello-world");
  });
});

describe("vaultDoctor", () => {
  let vaultDir: string;
  beforeEach(() => {
    vaultDir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-wiki-doctor-"));
  });
  afterEach(() => {
    fs.rmSync(vaultDir, { recursive: true, force: true });
  });

  it("reports ok on a clean minimal vault", async () => {
    const { initVault, vaultDoctor } = await import("../src/core/vault.js");
    initVault({ cwd: vaultDir, vaultName: "demo" });
    const fm = "---\ntype: concept\n---\n";
    fs.writeFileSync(path.join(vaultDir, "wiki", "concepts", "alpha.md"), `${fm}# Alpha\n`, "utf8");
    fs.writeFileSync(
      path.join(vaultDir, "wiki", "index.md"),
      "# Index\n\n## Concepts\n- [[concepts/alpha]] — the alpha concept\n",
      "utf8"
    );
    const r = vaultDoctor(vaultDir);
    expect(r.pageCount).toBe(1);
    expect(r.ok).toBe(true);
  });

  it("flags missing frontmatter, dead links, orphans, and not-in-index", async () => {
    const { initVault, vaultDoctor } = await import("../src/core/vault.js");
    initVault({ cwd: vaultDir, vaultName: "demo" });
    // Page with no frontmatter and a dead link.
    fs.writeFileSync(
      path.join(vaultDir, "wiki", "concepts", "beta.md"),
      "# Beta\n\nSee [[concepts/ghost]].\n",
      "utf8"
    );
    const r = vaultDoctor(vaultDir);
    expect(r.missingFrontmatter).toContain("wiki/concepts/beta.md");
    expect(r.deadLinks.some((d) => d.target === "concepts/ghost")).toBe(true);
    expect(r.orphanPages).toContain("wiki/concepts/beta.md");
    expect(r.notInIndex).toContain("wiki/concepts/beta.md");
    expect(r.ok).toBe(false);
  });
});

describe("vaultSearch", () => {
  let vaultDir: string;
  beforeEach(() => {
    vaultDir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-wiki-search-"));
  });
  afterEach(() => {
    fs.rmSync(vaultDir, { recursive: true, force: true });
  });

  it("finds matching lines across wiki pages, case-insensitive", async () => {
    const { initVault, vaultSearch } = await import("../src/core/vault.js");
    initVault({ cwd: vaultDir, vaultName: "demo" });
    fs.writeFileSync(
      path.join(vaultDir, "wiki", "concepts", "checkout.md"),
      "---\n---\n# Checkout\n\nGuest checkout was approved.\n",
      "utf8"
    );
    const r = vaultSearch(vaultDir, "GUEST checkout"); // case-insensitive
    expect(r.hits[0].file).toBe("wiki/concepts/checkout.md");
    expect(r.hits[0].text).toContain("Guest checkout");
    expect(vaultSearch(vaultDir, "nonexistent term").hitCount).toBe(0);
  });

  it("respects the limit", async () => {
    const { initVault, vaultSearch } = await import("../src/core/vault.js");
    initVault({ cwd: vaultDir, vaultName: "demo" });
    const body = Array.from({ length: 10 }, () => "match line").join("\n");
    fs.writeFileSync(path.join(vaultDir, "wiki", "concepts", "many.md"), `---\n---\n${body}\n`, "utf8");
    const r = vaultSearch(vaultDir, "match", 3);
    expect(r.hits.length).toBe(3);
  });
});

describe("stampSources + staleness", () => {
  let vaultDir: string;
  beforeEach(() => {
    vaultDir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-wiki-stamp-"));
  });
  afterEach(() => {
    fs.rmSync(vaultDir, { recursive: true, force: true });
  });

  it("stamps source pages and detects staleness when the raw file changes", async () => {
    const { initVault, stampSources, vaultDoctor } = await import("../src/core/vault.js");
    initVault({ cwd: vaultDir, vaultName: "demo" });
    const rawPath = path.join(vaultDir, "raw", "Notes V1.md");
    fs.writeFileSync(rawPath, "original content\n", "utf8");
    fs.writeFileSync(
      path.join(vaultDir, "wiki", "sources", "notes-v1.md"),
      "---\ntype: source\n---\n# Notes\n",
      "utf8"
    );

    const stamp = stampSources(vaultDir);
    expect(stamp.stamped[0].page).toBe("wiki/sources/notes-v1.md");
    expect(stamp.stamped[0].source).toBe("raw/Notes V1.md");

    // Clean immediately after stamping.
    let doc = vaultDoctor(vaultDir);
    expect(doc.staleSources).toEqual([]);
    expect(doc.unhashedSources).toEqual([]);

    // Mutate the raw file → now stale.
    fs.writeFileSync(rawPath, "edited content\n", "utf8");
    doc = vaultDoctor(vaultDir);
    expect(doc.staleSources).toContain("wiki/sources/notes-v1.md");
    expect(doc.ok).toBe(false);

    // Re-stamp acknowledges the change → clean again.
    stampSources(vaultDir);
    expect(vaultDoctor(vaultDir).staleSources).toEqual([]);
  });

  it("reports unhashed source pages until stamped", async () => {
    const { initVault, vaultDoctor } = await import("../src/core/vault.js");
    initVault({ cwd: vaultDir, vaultName: "demo" });
    fs.writeFileSync(path.join(vaultDir, "raw", "a.md"), "x\n", "utf8");
    fs.writeFileSync(path.join(vaultDir, "wiki", "sources", "a.md"), "---\ntype: source\n---\n", "utf8");
    expect(vaultDoctor(vaultDir).unhashedSources).toContain("wiki/sources/a.md");
  });
});

describe("linkProject", () => {
  let vaultDir: string;
  beforeEach(() => {
    vaultDir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-wiki-link-"));
  });
  afterEach(() => {
    fs.rmSync(vaultDir, { recursive: true, force: true });
  });

  it("adds a paired-projects row, writes a back-pointer, and is idempotent", async () => {
    const { initVault, linkProject, pairedProjectsFromClaude, vaultDoctor } = await import(
      "../src/core/vault.js"
    );
    initVault({ cwd: vaultDir, vaultName: "knowledge" });
    // Sibling repo with its own CLAUDE.md.
    const proj = path.join(vaultDir, "app");
    fs.mkdirSync(proj);
    fs.writeFileSync(path.join(proj, "CLAUDE.md"), "# App\n\nProject rules.\n", "utf8");

    const r = linkProject(vaultDir, { name: "app", path: "app/", purpose: "the product", status: "building" }, "knowledge");
    expect(r.action).toBe("added");
    expect(r.backlinkWritten).toBe(true);

    const rows = pairedProjectsFromClaude(vaultDir);
    expect(rows).toEqual([
      { name: "app", path: "app/", purpose: "the product", status: "building" }
    ]);

    const projClaude = fs.readFileSync(path.join(proj, "CLAUDE.md"), "utf8");
    expect(projClaude.startsWith("# App")).toBe(true); // host content preserved
    expect(projClaude).toContain("harness-wiki:vault-backlink");
    expect(projClaude).toContain("Knowledge vault");

    // The generated handoff subsection must survive the table rewrite.
    const claude = fs.readFileSync(path.join(vaultDir, "CLAUDE.md"), "utf8");
    expect(claude).toContain("### When a session is asked to work on a paired project");
    expect(claude).toContain("## Workflow");

    // Re-link updates in place (no duplicate row, no duplicate backlink).
    const r2 = linkProject(vaultDir, { name: "app", path: "app/", purpose: "the product v2", status: "shipped" }, "knowledge");
    expect(r2.action).toBe("updated");
    const rows2 = pairedProjectsFromClaude(vaultDir);
    expect(rows2.length).toBe(1);
    expect(rows2[0].status).toBe("shipped");
    const backlinks = fs.readFileSync(path.join(proj, "CLAUDE.md"), "utf8").match(/vault-backlink -->/g) ?? [];
    expect(backlinks.length).toBe(2); // one start + one end marker, not duplicated
  });

  it("flags broken paired-project paths in doctor", async () => {
    const { initVault, linkProject, vaultDoctor } = await import("../src/core/vault.js");
    initVault({ cwd: vaultDir, vaultName: "knowledge" });
    linkProject(vaultDir, { name: "ghost", path: "../does-not-exist/", purpose: "x", status: "design" }, "knowledge");
    const doc = vaultDoctor(vaultDir);
    expect(doc.brokenPairedProjects.some((p) => p.name === "ghost")).toBe(true);
    expect(doc.ok).toBe(false);
  });
});

describe("skill installer", () => {
  let installDir: string;

  beforeEach(() => {
    installDir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-wiki-skill-test-"));
  });

  afterEach(() => {
    fs.rmSync(installDir, { recursive: true, force: true });
  });

  it("installs the packaged skill into a target skills directory", async () => {
    const { installSkill } = await import("../src/core/skill.js");
    const result = installSkill({ targetDir: installDir });

    expect(result.target).toBe(path.join(installDir, "harness-wiki", "SKILL.md"));
    expect(fs.existsSync(result.target)).toBe(true);
    expect(fs.readFileSync(result.target, "utf8")).toContain("name: harness-wiki");
  });

  it("refuses to overwrite an existing skill without force", async () => {
    const { installSkill } = await import("../src/core/skill.js");
    installSkill({ targetDir: installDir });

    expect(() => installSkill({ targetDir: installDir })).toThrow(/Refusing to overwrite/);
    const forced = installSkill({ targetDir: installDir, force: true });
    expect(forced.overwritten).toBe(true);
  });
});
