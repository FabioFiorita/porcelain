import { readCommand } from '@porcelain/process';
import type { Limits } from '../../config/limits.ts';
import { macDefaultRoute } from './mac-network-output.ts';

type NetworkDiscoveryLimits = Limits['access']['networkDiscovery'];

function output(
  command: string,
  args: readonly string[],
  limits: NetworkDiscoveryLimits,
): string {
  try {
    return readCommand({
      command,
      args,
      timeoutMs: limits.commandTimeoutMs,
      maxBytes: limits.outputBytes,
    });
  } catch {
    return '';
  }
}

export function readMacRoute(limits: NetworkDiscoveryLimits): string {
  return output('/sbin/route', ['-n', 'get', 'default'], limits);
}

export function readMacNeighbour(limits: NetworkDiscoveryLimits): string {
  const route = macDefaultRoute(readMacRoute(limits));
  return route === undefined
    ? ''
    : output('/usr/sbin/arp', ['-n', route.gateway], limits);
}
