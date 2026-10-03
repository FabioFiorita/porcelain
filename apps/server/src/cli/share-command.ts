import {
  readRemoteAccessResponseSchema,
  setRemoteAccessResponseSchema,
  type ReadRemoteAccessResponse,
  type SetRemoteAccessRequest,
} from '@porcelain/contracts/access';
import type { Limits } from '../config/limits.ts';
import type { ShareAction } from './arguments.ts';
import { askOwner } from './owner-client.ts';

type Output = {
  stdout: (message: string) => void;
  stderr: (message: string) => void;
};

type Wait = (ms: number) => Promise<void>;

type RouteName = keyof ReadRemoteAccessResponse['routes'];
type Route = ReadRemoteAccessResponse['routes'][RouteName];
type FailureReason = Extract<Route['status'], { kind: 'failed' }>['reason'];

const ROUTES: readonly { name: RouteName; label: string }[] = [
  { name: 'lan', label: 'Local network' },
  { name: 'tailnet', label: 'Tailscale    ' },
  { name: 'cloudflare', label: 'Cloudflare   ' },
];

function printable(value: string): string {
  return value.replace(/\p{Cc}/gu, '?');
}

function failure(reason: FailureReason, hostname: string | undefined): string {
  const where = hostname === undefined ? '' : ` ${printable(hostname)}`;
  switch (reason) {
    case 'address-in-use':
      return 'another program already listens at this address';
    case 'address-unavailable':
      return 'this computer no longer has that address';
    case 'unreachable':
      return `nothing reaches this server at${where || ' its address'}`;
    case 'other-server':
      return `another server answers at${where || ' its address'}`;
  }
}

function hostnameOf(
  access: ReadRemoteAccessResponse,
  route: RouteName,
): string | undefined {
  if (route === 'tailnet') return access.tailnetHostname;
  if (route === 'cloudflare') return access.cloudflareHostname;
  return undefined;
}

function state(access: ReadRemoteAccessResponse, route: RouteName): string {
  const { enabled, status } = access.routes[route];
  switch (status.kind) {
    case 'off':
      return enabled ? 'on, not started yet' : 'off';
    case 'starting':
      return 'checking';
    case 'on':
      return `on  ${status.urls.map(printable).join('  ')}`;
    case 'paused':
      return 'paused: this computer is on another network than the one it was turned on for';
    case 'failed':
      return `failed: ${failure(status.reason, hostnameOf(access, route))}`;
  }
}

function report(access: ReadRemoteAccessResponse): string {
  const lines = [`Porcelain at ${printable(access.serviceUrl)}`];
  for (const { name, label } of ROUTES)
    lines.push(`  ${label}  ${state(access, name)}`);
  const network = access.lanNetwork ?? access.localNetwork;
  if (network !== undefined)
    lines.push(
      '',
      `Local network: ${printable(network.subnet)} through ${printable(network.interfaceName)}`,
    );
  if (access.tailnetHostname !== undefined)
    lines.push(`Tailscale name: ${printable(access.tailnetHostname)}`);
  if (access.tailnetTarget !== undefined)
    lines.push(
      'Run once on this computer so Tailscale forwards to Porcelain:',
      `  tailscale serve --bg --https=443 ${printable(access.tailnetTarget)}`,
    );
  if (access.cloudflareHostname !== undefined)
    lines.push(`Cloudflare hostname: ${printable(access.cloudflareHostname)}`);
  return `${lines.join('\n')}\n`;
}

function change(
  action: ShareAction,
  current: ReadRemoteAccessResponse,
): SetRemoteAccessRequest | undefined {
  switch (action.kind) {
    case 'show':
      return undefined;
    case 'lan':
      return { lan: action.on };
    case 'tailnet':
      return action.hostname === undefined
        ? { tailnet: false }
        : { tailnet: true, tailnetHostname: action.hostname };
    case 'cloudflare':
      return action.hostname === undefined
        ? { cloudflare: false }
        : { cloudflare: true, cloudflareHostname: action.hostname };
    case 'check': {
      const { lan, tailnet, cloudflare } = current.routes;
      if (!lan.enabled && !tailnet.enabled && !cloudflare.enabled)
        return undefined;
      return {
        ...(lan.enabled ? { lan: true } : {}),
        ...(tailnet.enabled ? { tailnet: true } : {}),
        ...(cloudflare.enabled ? { cloudflare: true } : {}),
      };
    }
  }
}

function settling(access: ReadRemoteAccessResponse): boolean {
  return ROUTES.some(({ name }) => {
    const { enabled, status } = access.routes[name];
    return status.kind === 'starting' || (!enabled && status.kind !== 'off');
  });
}

function touched(action: ShareAction): readonly RouteName[] {
  switch (action.kind) {
    case 'show':
      return [];
    case 'check':
      return ROUTES.map(({ name }) => name);
    case 'lan':
    case 'tailnet':
    case 'cloudflare':
      return [action.kind];
  }
}

function failing(
  access: ReadRemoteAccessResponse,
  routes: readonly RouteName[],
): boolean {
  return routes.some(
    (name) =>
      access.routes[name].enabled &&
      access.routes[name].status.kind === 'failed',
  );
}

async function readSharing(dataDirectory: string, limits: Limits) {
  return readRemoteAccessResponseSchema.parse(
    await askOwner(
      dataDirectory,
      'GET',
      '/remote-access',
      undefined,
      limits.owner.requestTimeoutMs,
    ),
  );
}

async function settled(
  dataDirectory: string,
  changed: ReadRemoteAccessResponse,
  limits: Limits,
  wait: Wait,
): Promise<ReadRemoteAccessResponse> {
  const polls = limits.cli.shareSettleMs / limits.cli.sharePollMs;
  let access = changed;
  for (let poll = 0; poll < polls && settling(access); poll += 1) {
    await wait(limits.cli.sharePollMs);
    access = await readSharing(dataDirectory, limits);
  }
  return access;
}

export async function shareRemoteAccess(
  dataDirectory: string,
  action: ShareAction,
  output: Output,
  limits: Limits,
  wait: Wait,
): Promise<number> {
  const current = await readSharing(dataDirectory, limits);
  const requested = change(action, current);
  if (requested === undefined) {
    output.stdout(report(current));
    if (action.kind === 'check')
      output.stderr('Nothing is shared, so there is nothing to check.\n');
    return action.kind === 'check' ? 1 : 0;
  }
  const changed = setRemoteAccessResponseSchema.parse(
    await askOwner(
      dataDirectory,
      'PATCH',
      '/remote-access',
      requested,
      limits.owner.requestTimeoutMs,
    ),
  );
  const access = await settled(dataDirectory, changed, limits, wait);
  output.stdout(report(access));
  if (settling(access))
    output.stdout(
      'Still checking; run porcelain share to see how it settles.\n',
    );
  return failing(access, touched(action)) ? 1 : 0;
}
