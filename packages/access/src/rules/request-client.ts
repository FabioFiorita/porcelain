import type { DeviceRoute } from '../models/device.ts';
import type {
  IdentifyRequestClientInput,
  RequestClient,
} from '../models/identify-request-client.ts';
import type { TailnetProxy } from '../models/remote-access.ts';
import {
  canonicalHostname,
  ipAddress,
  isLoopbackHostname,
} from './host-policy.ts';
import { isTailnetAddress } from './remote-access.ts';
import { arrivedThroughTailnet } from './tailnet.ts';
import { requestAuthority } from './request-authority.ts';

function tunnelHostnameOf(
  host: string | undefined,
  tunnelHosts: readonly string[],
): string | undefined {
  const authority = host === undefined ? undefined : requestAuthority(host);
  return authority !== undefined && tunnelHosts.includes(authority.hostname)
    ? authority.hostname
    : undefined;
}

function cloudflareVisitor(
  input: IdentifyRequestClientInput,
): string | undefined {
  const peer = canonicalHostname(input.peerAddress);
  if (peer === undefined || !isLoopbackHostname(peer)) return undefined;
  return input.connectingAddress === undefined
    ? undefined
    : ipAddress(input.connectingAddress);
}

function networkRoute(localAddress: string | undefined): DeviceRoute {
  return localAddress !== undefined && isTailnetAddress(localAddress)
    ? 'tailnet'
    : 'lan';
}

export function requestClient(
  input: IdentifyRequestClientInput,
  tunnelHosts: readonly string[],
  tailnetProxy?: TailnetProxy,
): RequestClient {
  const plain = {
    address: input.peerAddress,
    secure: input.scheme === 'https',
  };
  const local =
    input.localAddress === undefined
      ? undefined
      : canonicalHostname(input.localAddress);
  if (arrivedThroughTailnet(input, tailnetProxy))
    return {
      route: 'tailnet',
      address:
        (input.forwardedFor === undefined
          ? undefined
          : ipAddress(input.forwardedFor)) ?? input.peerAddress,
      secure: true,
    };
  if (local === undefined || !isLoopbackHostname(local))
    return { route: networkRoute(local), ...plain };
  const tunnelHostname = tunnelHostnameOf(input.host, tunnelHosts);
  if (tunnelHostname === undefined) return { route: 'loopback', ...plain };
  return {
    route: 'tunnel',
    address: cloudflareVisitor(input) ?? input.peerAddress,
    secure: true,
    tunnelHostname,
  };
}
