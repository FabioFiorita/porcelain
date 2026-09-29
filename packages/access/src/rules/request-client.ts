import type {
  IdentifyRequestClientInput,
  RequestClient,
} from '../models/identify-request-client.ts';
import {
  canonicalHostname,
  ipAddress,
  isLoopbackHostname,
} from './host-policy.ts';
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

export function requestClient(
  input: IdentifyRequestClientInput,
  tunnelHosts: readonly string[],
): RequestClient {
  const tunnelHostname = tunnelHostnameOf(input.host, tunnelHosts);
  if (tunnelHostname === undefined)
    return { address: input.peerAddress, secure: input.scheme === 'https' };
  return {
    address: cloudflareVisitor(input) ?? input.peerAddress,
    secure: true,
    tunnelHostname,
  };
}
