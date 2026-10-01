import { runCommand } from '@porcelain/process';
import type { Limits } from '../../config/limits.ts';
import { macPrimaryService } from './mac-network-output.ts';

type NetworkDiscoveryLimits = Limits['access']['networkDiscovery'];

async function output(
  command: string,
  args: readonly string[],
  limits: NetworkDiscoveryLimits,
  stdin?: string,
): Promise<string> {
  try {
    const result = await runCommand({
      command,
      args,
      stdin,
      timeoutMs: limits.commandTimeoutMs,
      maxBytes: limits.outputBytes,
      processGroup: limits.processGroup,
    });
    const completed =
      result.stopped === undefined || result.stopped === 'lingering';
    return completed && result.exitCode === 0
      ? result.stdout.toString('utf8')
      : '';
  } catch {
    return '';
  }
}

export function readMacRoute(limits: NetworkDiscoveryLimits): Promise<string> {
  return output('/sbin/route', ['-n', 'get', 'default'], limits);
}

export async function readMacPrimaryService(
  limits: NetworkDiscoveryLimits,
): Promise<string> {
  const service = macPrimaryService(
    await output(
      '/usr/sbin/scutil',
      [],
      limits,
      'show State:/Network/Global/IPv4\n',
    ),
  );
  return service === undefined
    ? ''
    : output(
        '/usr/sbin/scutil',
        [],
        limits,
        `show State:/Network/Service/${service}/IPv4\n`,
      );
}
