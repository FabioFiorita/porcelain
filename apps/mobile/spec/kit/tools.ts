import { spawnSync } from 'node:child_process';

export type Tool = 'simulator' | 'maestro' | 'agent-device';

const installs: Record<Tool, string> = {
  simulator:
    'Xcode with an iOS 26 or newer simulator runtime is missing: install Xcode from the App Store, run xcode-select --switch /Applications/Xcode.app and add the runtime in Xcode > Settings > Components',
  maestro:
    'Maestro is missing: install it with brew tap mobile-dev-inc/tap && brew install mobile-dev-inc/tap/maestro',
  'agent-device':
    'agent-device is missing: install it with npm install --global agent-device',
};

const probes: Record<Tool, readonly [string, ...string[]]> = {
  simulator: ['xcrun', 'simctl', 'help'],
  maestro: ['maestro', '--version'],
  'agent-device': ['agent-device', '--version'],
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
