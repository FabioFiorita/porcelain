import type { Limits } from '../config/limits.ts';
import type { Clock } from '@porcelain/kernel/ports';
import type { OwnerProbe } from '../ports/owner-probe.ts';
import { issuePairings, listAccess, revokeAccess } from './access-commands.ts';
import type { CliCommand } from './arguments.ts';
import { serveHelp } from './help.ts';
import { runLocalServer, type StartServer } from './launcher.ts';
import { runMcpBridge } from './mcp-bridge.ts';
import { runServiceCommand } from './service.ts';
import { reportStatus } from './status.ts';

type CommandContext = {
  signal: AbortSignal;
  homeDirectory: string;
  searchPath: string;
  clock: Clock;
  ownerProbe: OwnerProbe;
  startServer: StartServer;
  limits: Limits;
  stdout: (message: string) => void;
  stderr: (message: string) => void;
};

export async function runCommand(
  command: CliCommand,
  context: CommandContext,
): Promise<number> {
  const output = { stdout: context.stdout, stderr: context.stderr };
  switch (command.command) {
    case 'help':
      context.stdout(serveHelp);
      return 0;
    case 'status':
      return reportStatus(
        command.settings,
        output,
        context.ownerProbe,
        context.limits.owner.probeTimeoutMs,
      );
    case 'pair':
      await issuePairings(
        command.settings.dataDirectory,
        command.settings.labels,
        command.settings.addresses,
        output,
        context.limits,
      );
      return 0;
    case 'devices':
      await listAccess(command.settings.dataDirectory, output, context.limits);
      return 0;
    case 'revoke':
      return (await revokeAccess(
        command.settings.dataDirectory,
        command.settings.id,
        output,
        context.limits,
      ))
        ? 0
        : 1;
    case 'mcp':
      await runMcpBridge(
        command.settings.dataDirectory,
        context.limits.owner.mcpTimeoutMs,
      );
      return 0;
    case 'service':
      await runServiceCommand(command.settings, {
        homeDirectory: context.homeDirectory,
        searchPath: context.searchPath,
        clock: context.clock,
        ownerProbe: context.ownerProbe,
        limits: context.limits,
        stdout: context.stdout,
      });
      return 0;
    case 'serve':
      await runLocalServer(command.settings, context.signal, {
        startServer: context.startServer,
        output: (message) => context.stdout(`${message}\n`),
      });
      return 0;
  }
}
