#!/usr/bin/env node
import { initVault, vaultStatus } from "./core/vault.js";
import { runMcpServer } from "./mcp/server.js";
import { installSkill, skillTargetDir, type SkillInstallPreset } from "./core/skill.js";
import path from "node:path";

function usage(): never {
  console.error(`Usage:
  harness-wiki mcp
  harness-wiki vault-init --name <vaultName> [--domain <domain>] [--cwd <path>] [--force]
  harness-wiki vault-status [--cwd <path>]
  harness-wiki skill-install <codex|agents|local> [--force]
  harness-wiki skill-install --target <skillsDir> [--force]
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
  return value === "codex" || value === "agents" || value === "local";
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
