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
