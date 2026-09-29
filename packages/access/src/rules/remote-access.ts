import type {
  ListenOutcome,
  LocalNetwork,
  RemoteRoutes,
  RemoteAccess,
  RemoteAccessChange,
  RemoteAccessDecision,
  RemoteAccessSettings,
  RouteState,
  RouteStates,
  TunnelAnswer,
} from '../models/remote-access.ts';

const TAILNET_IPV4 = /^100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./;
const TAILNET_IPV6 = /^fd7a:115c:a1e0:/i;
const HOSTNAME_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const NUMERIC_LABEL = /^\d+$/;

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
  return [
    ...answeredTunnelHosts(settings, routes.states),
    ...(tailnet === undefined || routes.states.tailnet.kind !== 'on'
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

function lanChange(
  current: RemoteAccessSettings,
  change: RemoteAccessChange,
  network: LocalNetwork | undefined,
): Pick<RemoteAccessSettings, 'lan' | 'lanNetwork'> | undefined {
  if (change.lan === false) return { lan: false };
  if (change.lan === undefined)
    return { lan: current.lan, lanNetwork: current.lanNetwork };
  if (network === undefined) return undefined;
  return {
    lan: true,
    lanNetwork: {
      interfaceName: network.interfaceName,
      subnet: network.subnet,
    },
  };
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
  const lan = lanChange(current, change, network);
  if (lan === undefined) return { kind: 'no-local-network' };
  return {
    kind: 'settings',
    settings: {
      lan: lan.lan,
      ...(lan.lanNetwork === undefined ? {} : { lanNetwork: lan.lanNetwork }),
      tailnet: change.tailnet ?? current.tailnet,
      ...(current.tailnetServeTarget === undefined
        ? {}
        : { tailnetServeTarget: current.tailnetServeTarget }),
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
    tailnet: change.tailnet === true ? starting : states.tailnet,
    cloudflare:
      settings.cloudflare &&
      (change.cloudflare === true || change.cloudflareHostname !== undefined)
        ? starting
        : states.cloudflare,
  };
}

function networkOnly(network: LocalNetwork): LocalNetwork {
  return { interfaceName: network.interfaceName, subnet: network.subnet };
}

export function remoteAccessView(
  settings: RemoteAccessSettings,
  states: RouteStates,
  serviceUrl: string,
  here?: LocalNetwork,
): RemoteAccess {
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
    ...(settings.cloudflareHostname === undefined
      ? {}
      : { cloudflareHostname: settings.cloudflareHostname }),
    serviceUrl,
  };
}
