import { spawnSync } from 'node:child_process';
import { deviceHost, mainCheckoutHostFile } from './device-host.ts';

export function agentDevice(): string | undefined {
  return deviceHost().agentDevice;
}

function output(command: string, args: readonly string[]): string | undefined {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  return result.error === undefined && result.status === 0
    ? result.stdout.trim()
    : undefined;
}

export function agentDeviceVersion(): string | undefined {
  const executable = agentDevice();
  return executable === undefined
    ? undefined
    : output(executable, ['--version']);
}

export function agentDeviceMissing(): string {
  const executable = agentDevice();
  return executable === undefined
    ? `agent-device is not set up on this machine: install it (npm install --global agent-device; when you drive a Mac through its hub, use the hub's version) and set "agentDevice" in ${mainCheckoutHostFile()} to its absolute path`
    : `${executable}, named by "agentDevice" in ${mainCheckoutHostFile()}, does not run: install agent-device there or correct the path`;
}

export type Tool = 'simulator' | 'agent-device';

const problems: Record<Tool, () => string | undefined> = {
  simulator: () =>
    output('xcrun', ['simctl', 'help']) === undefined
      ? 'Xcode with an iOS 26 or newer simulator runtime is missing: install Xcode from the App Store, run xcode-select --switch /Applications/Xcode.app and add the runtime in Xcode > Settings > Components'
      : undefined,
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
