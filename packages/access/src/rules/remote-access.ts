import type {
  ListenOutcome,
  LocalNetwork,
  RemoteRoutes,
  RemoteAccess,
  RemoteAccessChange,
  RemoteAccessDecision,
  RemoteAccessProblem,
  RemoteAccessSettings,
  RouteState,
  RouteStates,
  TunnelAnswer,
} from '../models/remote-access.ts';
import { tailnetTarget } from './tailnet.ts';

const TAILNET_IPV4 = /^100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./;
const TAILNET_IPV6 = /^fd7a:115c:a1e0:/i;
const HOSTNAME_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const NUMERIC_LABEL = /^\d+$/;
const TAILNET_DOMAIN = '.ts.net';

export function isTailnetAddress(address: string): boolean {
  return TAILNET_IPV4.test(address) || TAILNET_IPV6.test(address);
}

export function tunnelHostname(
  value: string,
  maxLength: number,
): string | undefined {
  const trimmed = value.trim();
  const url = URL.parse(
    trimmed.includes('://') ? trimmed : `https://${trimmed}`,
  );
  if (
    !url ||
    url.protocol !== 'https:' ||
    trimmed.includes('@') ||
    url.port !== '' ||
    url.search !== '' ||
    url.hash !== '' ||
    url.pathname !== '/'
  )
    return undefined;
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  const labels = hostname.split('.');
  if (
    hostname.length > maxLength ||
    !hostname.includes('.') ||
    NUMERIC_LABEL.test(labels.at(-1) ?? '') ||
    !labels.every((label) => HOSTNAME_LABEL.test(label))
  )
    return undefined;
  return hostname;
}

function tailnetHostname(value: string, maxLength: number): string | undefined {
  const hostname = tunnelHostname(value, maxLength);
  return hostname?.endsWith(TAILNET_DOMAIN) ? hostname : undefined;
}

export function tunnelOrigin(hostname: string): string {
  return `https://${hostname}`;
}

export function tunnelHosts(settings: RemoteAccessSettings): string[] {
  return settings.cloudflare && settings.cloudflareHostname !== undefined
    ? [settings.cloudflareHostname]
    : [];
}

export function answeredTunnelHosts(
  settings: RemoteAccessSettings,
  states: RouteStates,
): string[] {
  const tunnel = states.cloudflare;
  return tunnel.kind === 'failed' && tunnel.reason === 'other-server'
    ? []
    : tunnelHosts(settings);
}

function routeUrl(address: string, port: number): string {
  return address.includes(':')
    ? `http://[${address}]:${port}`
    : `http://${address}:${port}`;
}

export function listenedState(outcome: ListenOutcome): RouteState {
  if (outcome.bound.length === 0)
    return {
      kind: 'failed',
      reason: outcome.failure ?? 'address-unavailable',
    };
  return {
    kind: 'on',
    urls: outcome.bound.map((address) => routeUrl(address, outcome.port)),
  };
}

export function httpsHosts(
  settings: RemoteAccessSettings,
  routes: RemoteRoutes,
): string[] {
  const tailnet = routes.tailnetProxy?.hostname;
  const tailnetState = routes.states.tailnet;
  return [
    ...answeredTunnelHosts(settings, routes.states),
    ...(tailnet === undefined ||
    (tailnetState.kind === 'failed' && tailnetState.reason === 'other-server')
      ? []
      : [tailnet]),
  ];
}

export function tunnelState(
  answer: TunnelAnswer,
  environmentId: string,
  origin: string,
): RouteState {
  if (answer.kind === 'unreachable')
    return { kind: 'failed', reason: 'unreachable' };
  return answer.kind === 'answered' && answer.environmentId === environmentId
    ? { kind: 'on', urls: [origin] }
    : { kind: 'failed', reason: 'other-server' };
}

export function tunnelNeedsCheck(state: RouteState): boolean {
  return state.kind === 'off' || state.kind === 'starting';
}

export function reachableOrigins(states: RouteStates): string[] {
  return [states.lan, states.tailnet, states.cloudflare].flatMap((state) =>
    state.kind === 'on' ? state.urls : [],
  );
}

function networkOnly(network: LocalNetwork): LocalNetwork {
  return {
    interfaceName: network.interfaceName,
    subnet: network.subnet,
    gateway: network.gateway,
    ...(network.gatewayHardware === undefined
      ? {}
      : { gatewayHardware: network.gatewayHardware }),
  };
}

type LanChange =
  | { kind: 'lan'; lan: boolean; lanNetwork?: LocalNetwork | undefined }
  | RemoteAccessProblem;

function lanChange(
  current: RemoteAccessSettings,
  change: RemoteAccessChange,
  network: LocalNetwork | undefined,
): LanChange {
  if (change.lan === false) return { kind: 'lan', lan: false };
  if (change.lan === undefined)
    return { kind: 'lan', lan: current.lan, lanNetwork: current.lanNetwork };
  if (network === undefined) return { kind: 'no-local-network' };
  if (network.gatewayHardware === undefined)
    return { kind: 'unidentified-local-network' };
  return { kind: 'lan', lan: true, lanNetwork: networkOnly(network) };
}

type TailnetChange =
  | { kind: 'tailnet'; tailnet: boolean; hostname?: string | undefined }
  | RemoteAccessProblem;

function tailnetChange(
  current: RemoteAccessSettings,
  change: RemoteAccessChange,
  hostnameLength: number,
): TailnetChange {
  const hostname =
    change.tailnetHostname === undefined
      ? current.tailnetHostname
      : tailnetHostname(change.tailnetHostname, hostnameLength);
  if (change.tailnetHostname !== undefined && hostname === undefined)
    return { kind: 'invalid-tailnet-hostname' };
  const tailnet = change.tailnet ?? current.tailnet;
  if (tailnet && hostname === undefined)
    return { kind: 'missing-tailnet-hostname' };
  return { kind: 'tailnet', tailnet, hostname };
}

export function changedRemoteAccess(
  current: RemoteAccessSettings,
  change: RemoteAccessChange,
  hostnameLength: number,
  network?: LocalNetwork,
): RemoteAccessDecision {
  const hostname =
    change.cloudflareHostname === undefined
      ? current.cloudflareHostname
      : tunnelHostname(change.cloudflareHostname, hostnameLength);
  if (change.cloudflareHostname !== undefined && hostname === undefined)
    return { kind: 'invalid-hostname' };
  const cloudflare = change.cloudflare ?? current.cloudflare;
  if (cloudflare && hostname === undefined) return { kind: 'missing-hostname' };
  const tailnet = tailnetChange(current, change, hostnameLength);
  if (tailnet.kind !== 'tailnet') return tailnet;
  const lan = lanChange(current, change, network);
  if (lan.kind !== 'lan') return lan;
  const port = tailnet.tailnet ? current.tailnetPort : undefined;
  return {
    kind: 'settings',
    settings: {
      lan: lan.lan,
      ...(lan.lanNetwork === undefined ? {} : { lanNetwork: lan.lanNetwork }),
      tailnet: tailnet.tailnet,
      ...(tailnet.hostname === undefined
        ? {}
        : { tailnetHostname: tailnet.hostname }),
      ...(port === undefined ? {} : { tailnetPort: port }),
      cloudflare,
      ...(hostname === undefined ? {} : { cloudflareHostname: hostname }),
    },
  };
}

export function requestedStates(
  states: RouteStates,
  change: RemoteAccessChange,
  settings: RemoteAccessSettings,
): RouteStates {
  const starting: RouteState = { kind: 'starting' };
  return {
    lan: change.lan === true ? starting : states.lan,
    tailnet:
      settings.tailnet &&
      (change.tailnet === true || change.tailnetHostname !== undefined)
        ? starting
        : states.tailnet,
    cloudflare:
      settings.cloudflare &&
      (change.cloudflare === true || change.cloudflareHostname !== undefined)
        ? starting
        : states.cloudflare,
  };
}

export function remoteAccessView(
  settings: RemoteAccessSettings,
  routes: RemoteRoutes,
  serviceUrl: string,
  here?: LocalNetwork,
): RemoteAccess {
  const { states, tailnetProxy } = routes;
  return {
    routes: {
      lan: { enabled: settings.lan, status: states.lan },
      tailnet: { enabled: settings.tailnet, status: states.tailnet },
      cloudflare: { enabled: settings.cloudflare, status: states.cloudflare },
    },
    ...(settings.lan && settings.lanNetwork !== undefined
      ? { lanNetwork: networkOnly(settings.lanNetwork) }
      : {}),
    ...(here === undefined ? {} : { localNetwork: networkOnly(here) }),
    ...(settings.tailnetHostname === undefined
      ? {}
      : { tailnetHostname: settings.tailnetHostname }),
    ...(settings.tailnet && tailnetProxy !== undefined
      ? {
          tailnetTarget: tailnetTarget(tailnetProxy.address, tailnetProxy.port),
        }
      : {}),
    ...(settings.cloudflareHostname === undefined
      ? {}
      : { cloudflareHostname: settings.cloudflareHostname }),
    serviceUrl,
  };
}
