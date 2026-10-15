import { existsSync } from 'node:fs';
import { join } from 'node:path';
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

export type Tool = 'simulator' | 'agent-device' | 'android';

const problems: Record<Tool, () => string | undefined> = {
  android: () => {
    if (output('adb', ['version']) === undefined)
      return 'Android SDK platform-tools are missing: install Android Studio and add $ANDROID_HOME/platform-tools to PATH.';
    if (
      !existsSync(
        process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT ?? '',
      )
    )
      return 'Set ANDROID_HOME to your Android SDK directory; install the platform, build-tools, NDK and CMake requested by Expo prebuild using Android Studio SDK Manager, and accept SDK licenses.';
    const javaHome = process.env.JAVA_HOME;
    const java = javaHome ? join(javaHome, 'bin/java') : 'java';
    const javac = javaHome ? join(javaHome, 'bin/javac') : 'javac';
    if (
      spawnSync(java, ['-version']).status !== 0 ||
      output(javac, ['-version']) === undefined
    )
      return 'A JDK is missing: install the JDK required by the generated Android Gradle plugin and set JAVA_HOME.';
    return undefined;
  },
  simulator: () =>
    output('xcrun', ['simctl', 'help']) === undefined
      ? 'Xcode with an iOS 26 or newer simulator runtime is missing: install Xcode from the App Store, run xcode-select --switch /Applications/Xcode.app and add the runtime in Xcode > Settings > Components'
      : undefined,
  'agent-device': () =>
    agentDeviceVersion() === undefined ? agentDeviceMissing() : undefined,
};

export function missingTools(tools: readonly Tool[]): string[] {
  if (tools.includes('simulator') && process.platform !== 'darwin')
    return [
      `Mobile proof needs macOS with Xcode and an iOS simulator; this is ${process.platform}. Run it on a Mac.`,
    ];
  return tools.flatMap((tool) => problems[tool]() ?? []);
}
