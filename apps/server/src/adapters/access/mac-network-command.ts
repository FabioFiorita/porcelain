import { readCommand } from '@porcelain/process';
import type { Limits } from '../../config/limits.ts';
import { macPrimaryService } from './mac-network-output.ts';

type NetworkDiscoveryLimits = Limits['access']['networkDiscovery'];

function output(
  command: string,
  args: readonly string[],
  limits: NetworkDiscoveryLimits,
  input?: string,
): string {
  try {
    return readCommand({
      command,
      args,
      timeoutMs: limits.commandTimeoutMs,
      maxBytes: limits.outputBytes,
      ...(input === undefined ? {} : { input }),
    });
  } catch {
    return '';
  }
}

export function readMacRoute(limits: NetworkDiscoveryLimits): string {
  return output('/sbin/route', ['-n', 'get', 'default'], limits);
}

export function readMacPrimaryService(limits: NetworkDiscoveryLimits): string {
  const service = macPrimaryService(
    output('/usr/sbin/scutil', [], limits, 'show State:/Network/Global/IPv4\n'),
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
