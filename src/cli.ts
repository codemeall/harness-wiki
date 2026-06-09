#!/usr/bin/env node
import { initVault, vaultStatus } from "./core/vault.js";
import { runMcpServer } from "./mcp/server.js";

function usage(): never {
  console.error(`Usage:
  harness-wiki mcp
  harness-wiki vault-init --name <vaultName> [--domain <domain>] [--force]
  harness-wiki vault-status
`);
  process.exit(2);
}

function readFlag(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  return args[index + 1];
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
      cwd: process.cwd(),
      vaultName: name,
      domain,
      force
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === "vault-status") {
    console.log(JSON.stringify(vaultStatus(process.cwd()), null, 2));
    return;
  }

  usage();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
