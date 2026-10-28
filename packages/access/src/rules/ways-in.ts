import { Brand } from 'effect';
import { sha256Hex } from '@porcelain/kernel/rules';
import type {
  LocalNetwork,
  RemoteAccessChange,
  RemoteAccessSettings,
  RouteStates,
} from '../models/remote-access.ts';
import type {
  WaysInCaller,
  WaysInFingerprint,
  WaysInRoute,
} from '../models/ways-in.ts';

const fingerprint = Brand.nominal<WaysInFingerprint>();

const ROUTE_FIELDS: Readonly<
  Record<WaysInRoute, readonly (keyof RemoteAccessChange)[]>
> = {
  lan: ['lan'],
  tailnet: ['tailnet', 'tailnetHostname'],
  cloudflare: ['cloudflare', 'cloudflareHostname'],
};

function networkFacts(network: LocalNetwork | undefined) {
  return network === undefined
    ? undefined
    : [
        network.interfaceName,
        network.subnet,
        network.gateway,
        network.gatewayHardware,
      ];
}

export function waysInFingerprint(
  settings: RemoteAccessSettings,
  here: LocalNetwork | undefined,
): WaysInFingerprint {
  return fingerprint(
    sha256Hex(
      JSON.stringify([
        settings.lan,
        networkFacts(settings.lanNetwork),
        settings.tailnet,
        settings.tailnetHostname,
        settings.cloudflare,
        settings.cloudflareHostname,
        networkFacts(here),
      ]),
    ),
  );
}

export function protectedRoute(caller: WaysInCaller): WaysInRoute | undefined {
  if (caller.viewer.kind === 'owner' || caller.local) return undefined;
  switch (caller.route) {
    case 'lan':
      return 'lan';
    case 'tailnet':
      return 'tailnet';
    case 'tunnel':
      return 'cloudflare';
    case 'loopback':
      return undefined;
  }
}

export function changesRoute(
  change: RemoteAccessChange,
  route: WaysInRoute | undefined,
): boolean {
  return (
    route !== undefined &&
    ROUTE_FIELDS[route].some((field) => change[field] !== undefined)
  );
}

function sameState(
  left: RouteStates[WaysInRoute],
  right: RouteStates[WaysInRoute],
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function waysInUnchanged(
  current: { settings: RemoteAccessSettings; states: RouteStates },
  next: { settings: RemoteAccessSettings; states: RouteStates },
  here: LocalNetwork | undefined,
): boolean {
  return (
    waysInFingerprint(current.settings, here) ===
      waysInFingerprint(next.settings, here) &&
    (['lan', 'tailnet', 'cloudflare'] as const).every((route) =>
      sameState(current.states[route], next.states[route]),
    )
  );
}
