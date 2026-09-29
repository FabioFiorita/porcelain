export type ListenedRoute = 'lan' | 'tailnet';

export type RemoteAccessSettings = {
  lan: boolean;
  tailnet: boolean;
  cloudflare: boolean;
  cloudflareHostname?: string | undefined;
};

export type RemoteAccessChange = {
  lan?: boolean | undefined;
  tailnet?: boolean | undefined;
  cloudflare?: boolean | undefined;
  cloudflareHostname?: string | undefined;
};

type RouteFailure =
  | 'no-address'
  | 'address-in-use'
  | 'address-unavailable'
  | 'unreachable'
  | 'other-server';

export type RouteState =
  | { kind: 'off' }
  | { kind: 'starting' }
  | { kind: 'on'; urls: string[] }
  | { kind: 'failed'; reason: RouteFailure };

export type RouteStates = {
  lan: RouteState;
  tailnet: RouteState;
  cloudflare: RouteState;
};

export type RemoteRoutes = { states: RouteStates; origins: string[] };

type RemoteRouteView = { enabled: boolean; status: RouteState };

export type RemoteAccess = {
  routes: {
    lan: RemoteRouteView;
    tailnet: RemoteRouteView;
    cloudflare: RemoteRouteView;
  };
  cloudflareHostname?: string | undefined;
  serviceUrl: string;
};

export type NetworkAddress = {
  interfaceName: string;
  address: string;
  family: string;
  internal: boolean;
};

export type RouteAddresses = { route: ListenedRoute; addresses: string[] };

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

export type OpenRemoteRoutesInput = { environmentId: string };

export type RemoteAccessOptions = { hostnameLength: number };

export type RemoteAccessProblem =
  | { kind: 'invalid-hostname' }
  | { kind: 'missing-hostname' };

export type RemoteAccessDecision =
  | { kind: 'settings'; settings: RemoteAccessSettings }
  | RemoteAccessProblem;
