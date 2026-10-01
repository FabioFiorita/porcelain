export type ListenedRoute = 'lan' | 'tailnet';

export type LocalNetwork = {
  interfaceName: string;
  subnet: string;
  gateway: string;
  gatewayHardware?: string | undefined;
};

export type LocalNetworkAddress = LocalNetwork & { address: string };

export type RemoteAccessSettings = {
  lan: boolean;
  lanNetwork?: LocalNetwork | undefined;
  tailnet: boolean;
  tailnetHostname?: string | undefined;
  tailnetPort?: number | undefined;
  cloudflare: boolean;
  cloudflareHostname?: string | undefined;
};

export type RemoteAccessChange = {
  lan?: boolean | undefined;
  tailnet?: boolean | undefined;
  tailnetHostname?: string | undefined;
  cloudflare?: boolean | undefined;
  cloudflareHostname?: string | undefined;
};

type RouteFailure =
  | 'address-in-use'
  | 'address-unavailable'
  | 'unreachable'
  | 'other-server';

export type RouteState =
  | { kind: 'off' }
  | { kind: 'starting' }
  | { kind: 'on'; urls: string[] }
  | { kind: 'paused' }
  | { kind: 'failed'; reason: RouteFailure };

export type RouteStates = {
  lan: RouteState;
  tailnet: RouteState;
  cloudflare: RouteState;
};

export type TailnetProxy = {
  address: string;
  port: number;
  hostname: string;
};

export type RemoteRoutes = {
  states: RouteStates;
  origins: string[];
  tailnetProxy?: TailnetProxy | undefined;
};

type RemoteRouteView = { enabled: boolean; status: RouteState };

export type RemoteAccess = {
  routes: {
    lan: RemoteRouteView;
    tailnet: RemoteRouteView;
    cloudflare: RemoteRouteView;
  };
  lanNetwork?: LocalNetwork | undefined;
  localNetwork?: LocalNetwork | undefined;
  tailnetHostname?: string | undefined;
  tailnetTarget?: string | undefined;
  cloudflareHostname?: string | undefined;
  serviceUrl: string;
};

export type NetworkAddress = {
  interfaceName: string;
  address: string;
  family: string;
  internal: boolean;
  physical: boolean;
  netmask?: string | undefined;
  cidr?: string | undefined;
};

export type DefaultRoute = {
  interfaceName: string;
  metric: number;
  gateway: string;
  gatewayHardware?: string | undefined;
};

export type RouteAddresses = {
  route: ListenedRoute;
  addresses: string[];
  port: 'server' | 'own' | number;
};

export type RouteKey = { route: ListenedRoute };

export type ListenOutcome = {
  port: number;
  bound: string[];
  failure?: 'address-in-use' | 'address-unavailable' | undefined;
};

export type TunnelTarget = { origin: string };

export type TunnelHostnames = { hostnames: string[] };

export type TunnelAnswer =
  | { kind: 'answered'; environmentId: string }
  | { kind: 'foreign' }
  | { kind: 'unreachable' };

export type OpenRemoteRoutesInput = {
  environmentId: string;
  closing?: boolean | undefined;
};

export type RemoteRouteOptions = { loopbackAddress: string };

export type RemoteAccessOptions = { hostnameLength: number };

export type RemoteAccessProblem =
  | { kind: 'invalid-hostname' }
  | { kind: 'missing-hostname' }
  | { kind: 'invalid-tailnet-hostname' }
  | { kind: 'missing-tailnet-hostname' }
  | { kind: 'no-local-network' }
  | { kind: 'unidentified-local-network' };

export type RemoteAccessDecision =
  | { kind: 'settings'; settings: RemoteAccessSettings }
  | RemoteAccessProblem;
