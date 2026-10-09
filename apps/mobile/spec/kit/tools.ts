import { Schema } from 'effect';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repositoryRoot } from './development-client.ts';

export const agentDevice = join(
  repositoryRoot,
  'node_modules',
  '.bin',
  'agent-device',
);
export const agentDeviceVersion = Schema.decodeUnknownSync(
  Schema.Struct({
    devDependencies: Schema.Struct({ 'agent-device': Schema.String }),
  }),
)(JSON.parse(readFileSync(join(repositoryRoot, 'package.json'), 'utf8')))
  .devDependencies['agent-device'];

export type Tool = 'simulator' | 'maestro' | 'agent-device';

const installs: Record<Tool, string> = {
  simulator:
    'Xcode with an iOS 26 or newer simulator runtime is missing: install Xcode from the App Store, run xcode-select --switch /Applications/Xcode.app and add the runtime in Xcode > Settings > Components',
  maestro:
    'Maestro is missing: install it with brew tap mobile-dev-inc/tap && brew install mobile-dev-inc/tap/maestro',
  'agent-device': `agent-device ${agentDeviceVersion} is missing from this checkout: run pnpm install, which installs the version the repository pins`,
};

const probes: Record<Tool, readonly [string, ...string[]]> = {
  simulator: ['xcrun', 'simctl', 'help'],
  maestro: ['maestro', '--version'],
  'agent-device': [agentDevice, '--version'],
};

function runs([command, ...args]: readonly [string, ...string[]]): boolean {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  return result.error === undefined && result.status === 0;
}

export function missingTools(tools: readonly Tool[]): string[] {
  if (process.platform !== 'darwin')
    return [
      `Mobile proof needs macOS with Xcode and an iOS simulator; this is ${process.platform}. Run it on a Mac.`,
    ];
  return tools.flatMap((tool) => (runs(probes[tool]) ? [] : [installs[tool]]));
}
