import type {
  TailnetReadiness,
  TailnetReport,
  TailnetServeOutcome,
  TailnetServePlan,
  TailnetFailure,
  TailnetServing,
} from '../models/remote-access.ts';

const HOSTNAME_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function tailnetHostname(dnsName: string): string | undefined {
  const hostname = dnsName.trim().toLowerCase().replace(/\.$/, '');
  const labels = hostname.split('.');
  return labels.length > 1 &&
    labels.every((label) => HOSTNAME_LABEL.test(label))
    ? hostname
    : undefined;
}

export function tailnetReadiness(report: TailnetReport): TailnetReadiness {
  if (report.kind === 'missing')
    return { kind: 'failed', reason: 'tailscale-missing' };
  if (report.kind === 'unavailable')
    return { kind: 'failed', reason: 'tailscale-unavailable' };
  const hostname =
    report.dnsName === undefined ? undefined : tailnetHostname(report.dnsName);
  if (!report.running || hostname === undefined)
    return { kind: 'failed', reason: 'tailscale-stopped' };
  if (!report.https) return { kind: 'failed', reason: 'https-disabled' };
  return { kind: 'ready', hostname, serving: report.serving };
}

export function tailnetServePlan(
  serving: TailnetServing,
  target: string,
  previous: string | undefined,
): TailnetServePlan {
  if (serving.kind === 'nothing') return 'serve';
  if (serving.kind === 'other') return 'taken';
  if (serving.target === target) return 'keep';
  return serving.target === previous ? 'serve' : 'taken';
}

export function tailnetServedByUs(
  report: TailnetReport,
  previous: string | undefined,
): boolean {
  return (
    previous !== undefined &&
    report.kind === 'status' &&
    report.serving.kind === 'proxy' &&
    report.serving.target === previous
  );
}

export function tailnetServeFailure(
  outcome: TailnetServeOutcome,
): TailnetFailure | undefined {
  switch (outcome.kind) {
    case 'done':
      return undefined;
    case 'denied':
      return 'serve-denied';
    case 'failed':
      return 'serve-failed';
  }
}

export function tailnetServePort(target: string): number | undefined {
  const url = URL.parse(target);
  const port = Number(url?.port);
  return url?.protocol === 'http:' && Number.isInteger(port) && port > 0
    ? port
    : undefined;
}

export function tailnetTarget(address: string, port: number): string {
  return `http://${address}:${port}`;
}

export function tailnetOrigin(hostname: string): string {
  return `https://${hostname}`;
}
