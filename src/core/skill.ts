import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const SKILL_NAME = "harness-wiki";
export const SKILL_FILE = "SKILL.md";
export const SKILL_SOURCE = new URL("../../skills/harness-wiki/SKILL.md", import.meta.url);

export type SkillInstallPreset = "codex" | "agents" | "local";

export interface InstallSkillOptions {
  targetDir: string;
  force?: boolean;
}

export interface InstallSkillResult {
  source: string;
  target: string;
  createdDir: string;
  overwritten: boolean;
}

export function skillTargetDir(preset: SkillInstallPreset, cwd = process.cwd()): string {
  if (preset === "codex") return path.join(os.homedir(), ".codex", "skills");
  if (preset === "agents") return path.join(os.homedir(), ".agents", "skills");
  return path.join(cwd, ".agents", "skills");
}

export function expandHome(input: string): string {
  if (input === "~") return os.homedir();
  if (input.startsWith("~/")) return path.join(os.homedir(), input.slice(2));
  return input;
}

export function installSkill(options: InstallSkillOptions): InstallSkillResult {
  const sourcePath = fileURLToPath(SKILL_SOURCE);
  const targetRoot = path.resolve(expandHome(options.targetDir));
  const skillDir = path.join(targetRoot, SKILL_NAME);
  const target = path.join(skillDir, SKILL_FILE);
  const existed = fs.existsSync(target);

  if (existed && !options.force) {
    throw new Error(`Refusing to overwrite existing skill: ${target}. Pass --force to replace it.`);
  }

  fs.mkdirSync(skillDir, { recursive: true });
  fs.copyFileSync(sourcePath, target);

  return {
    source: sourcePath,
    target,
    createdDir: skillDir,
    overwritten: existed
  };
}
