import { spawnSync } from 'node:child_process';
import { deviceHost, mainCheckoutHostFile } from './device-host.ts';

export function agentDevice(): string | undefined {
  return deviceHost().agentDevice;
}
export function agentDeviceMissing(): string {
  return `agent-device is not set up on this machine: install it (npm install --global agent-device) at the same version as your device hub, and set "agentDevice" in ${mainCheckoutHostFile()} to its absolute path`;
}
export function agentDeviceVersion(): string | undefined {
  const executable = agentDevice();
  if (executable === undefined) return undefined;
  const result = spawnSync(executable, ['--version'], { encoding: 'utf8' });
  return result.error === undefined && result.status === 0
    ? result.stdout.trim()
    : undefined;
}

export type Tool = 'simulator' | 'agent-device';

function simulatorProblem(): string | undefined {
  const result = spawnSync('xcrun', ['simctl', 'help'], { encoding: 'utf8' });
  return result.error === undefined && result.status === 0
    ? undefined
    : 'Xcode with an iOS 26 or newer simulator runtime is missing: install Xcode from the App Store, run xcode-select --switch /Applications/Xcode.app and add the runtime in Xcode > Settings > Components';
}

const problems: Record<Tool, () => string | undefined> = {
  simulator: simulatorProblem,
  'agent-device': () =>
    agentDeviceVersion() === undefined ? agentDeviceMissing() : undefined,
};

export function missingTools(tools: readonly Tool[]): string[] {
  if (process.platform !== 'darwin')
    return [
      `Mobile proof needs macOS with Xcode and an iOS simulator; this is ${process.platform}. Run it on a Mac.`,
    ];
  return tools.flatMap((tool) => problems[tool]() ?? []);
}
