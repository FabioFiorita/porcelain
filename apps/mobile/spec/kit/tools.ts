import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const agentDevice = join(
  homedir(),
  '.local',
  'share',
  'engineering',
  'agent-device',
  'current',
  'node_modules',
  '.bin',
  'agent-device',
);
export const agentDeviceMissing =
  'agent-device is not synced on this machine: run `device sync` from the engineering plugin, which keeps it at the version T3 Code pins';
export function agentDeviceVersion(): string | undefined {
  const result = spawnSync(agentDevice, ['--version'], { encoding: 'utf8' });
  return result.error === undefined && result.status === 0
    ? result.stdout.trim()
    : undefined;
}

export type Tool = 'simulator' | 'agent-device';

const installs: Record<Tool, string> = {
  simulator:
    'Xcode with an iOS 26 or newer simulator runtime is missing: install Xcode from the App Store, run xcode-select --switch /Applications/Xcode.app and add the runtime in Xcode > Settings > Components',
  'agent-device': agentDeviceMissing,
};

const probes: Record<Tool, readonly [string, ...string[]]> = {
  simulator: ['xcrun', 'simctl', 'help'],
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
