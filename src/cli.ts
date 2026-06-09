#!/usr/bin/env node
import { initVault, vaultStatus, vaultDoctor, vaultSearch, stampSources, linkProject } from "./core/vault.js";
import { runMcpServer } from "./mcp/server.js";
import { installSkill, skillTargetDir, SKILL_PRESETS, type SkillInstallPreset } from "./core/skill.js";
import path from "node:path";

function usage(): never {
  console.error(`Usage:
  harness-wiki mcp
  harness-wiki vault-init --name <vaultName> [--domain <domain>] [--cwd <path>] [--force]
  harness-wiki vault-status [--cwd <path>]
  harness-wiki vault-doctor [--cwd <path>]
  harness-wiki vault-search <query> [--cwd <path>] [--limit <n>]
  harness-wiki vault-stamp [--cwd <path>]
  harness-wiki vault-link --name <name> --path <path> --purpose <text> --status <text> [--cwd <path>] [--vault-name <name>]
  harness-wiki skill-install <claude|claude-project|codex|agents|local> [--force]
  harness-wiki skill-install --target <skillsDir> [--force]

skill-install presets:
${Object.entries(SKILL_PRESETS)
  .map(([k, v]) => `  ${k.padEnd(15)} ${v}`)
  .join("\n")}
`);
  process.exit(2);
}

function readFlag(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  return args[index + 1];
}

function resolveCwd(args: string[]): string {
  const cwd = readFlag(args, "--cwd");
  return cwd ? path.resolve(cwd) : process.cwd();
}

function isSkillInstallPreset(value: string | undefined): value is SkillInstallPreset {
  return value !== undefined && value in SKILL_PRESETS;
}

async function main() {
  const [command, ...args] = process.argv.slice(2);

  if (!command) usage();

  if (command === "mcp") {
    await runMcpServer(process.cwd());
    return;
  }

  if (command === "vault-init") {
    const name = readFlag(args, "--name");
    if (!name) usage();
    const domain = readFlag(args, "--domain");
    const force = args.includes("--force");
    const result = initVault({
      cwd: resolveCwd(args),
      vaultName: name,
      domain,
      force
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === "vault-status") {
    console.log(JSON.stringify(vaultStatus(resolveCwd(args)), null, 2));
    return;
  }

  if (command === "vault-doctor") {
    console.log(JSON.stringify(vaultDoctor(resolveCwd(args)), null, 2));
    return;
  }

  if (command === "vault-search") {
    const query = args.find((arg) => !arg.startsWith("--"));
    if (!query) usage();
    const limitRaw = readFlag(args, "--limit");
    const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;
    console.log(JSON.stringify(vaultSearch(resolveCwd(args), query, limit), null, 2));
    return;
  }

  if (command === "vault-stamp") {
    console.log(JSON.stringify(stampSources(resolveCwd(args)), null, 2));
    return;
  }

  if (command === "vault-link") {
    const name = readFlag(args, "--name");
    const projPath = readFlag(args, "--path");
    const purpose = readFlag(args, "--purpose");
    const status = readFlag(args, "--status");
    if (!name || !projPath || !purpose || !status) usage();
    const vaultName = readFlag(args, "--vault-name") ?? "knowledge";
    const result = linkProject(
      resolveCwd(args),
      { name, path: projPath, purpose, status },
      vaultName
    );
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === "skill-install") {
    const target = readFlag(args, "--target");
    const preset = args.find((arg) => !arg.startsWith("--"));
    if (!target && !isSkillInstallPreset(preset)) usage();

    const targetDir = target ?? skillTargetDir(preset as SkillInstallPreset, process.cwd());
    const result = installSkill({
      targetDir,
      force: args.includes("--force")
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  usage();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
