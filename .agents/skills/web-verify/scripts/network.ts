import { browserNetwork } from '../../../../apps/server/spec/kit/browser-network.ts';
import { Usage } from '../../server-verify/scripts/core/cli.ts';

type Run = (code: string) => string;

const reconnectWithinMs = 15_000;

const ensure = `const context = page.context();
  if (context.porcelainNetwork === undefined) {
    context.porcelainNetwork = (${browserNetwork.toString()})(context);
    context.porcelainHeld = [];
    context.porcelainFailed = [];
    await context.porcelainNetwork.live.route();
  }
  const network = context.porcelainNetwork;`;

export const installNetwork = `async page => {
  ${ensure}
  return 'routed';
}`;

function request(spec: string | undefined) {
  const match = /^([A-Z]+)\s+(\/\S*)$/.exec(spec ?? '');
  if (match?.[1] === undefined || match[2] === undefined)
    throw new Usage(
      'Name the request as "<METHOD> <path>", such as "GET /api/worktrees/:worktreeId/review"; a :name or * segment matches any one segment.',
    );
  const segments = match[2]
    .split('/')
    .map((segment) =>
      segment.startsWith(':') || segment === '*'
        ? '[^/]+'
        : segment.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    );
  return {
    label: `${match[1]} ${match[2]}`,
    method: match[1],
    pattern: `^${segments.join('/')}$`,
  };
}

function matcher(spec: string | undefined) {
  const { label, method, pattern } = request(spec);
  return {
    label,
    code: `(request) => request.method() === ${JSON.stringify(method)} && new RegExp(${JSON.stringify(pattern)}).test(request.url().replace(/^[a-z]+:\\/\\/[^/]+/, '').split(/[?#]/)[0])`,
  };
}

function hold(spec: string | undefined) {
  const { label, code } = matcher(spec);
  return `async page => {
  ${ensure}
  const held = { label: ${JSON.stringify(label)}, caught: false };
  held.gate = await network.holdNext(${code});
  held.gate.requested.then(() => { held.caught = true; });
  held.gate.arm();
  context.porcelainHeld.push(held);
  return 'holding the next ' + held.label + ' until network release';
}`;
}

const release = `async page => {
  ${ensure}
  const held = context.porcelainHeld.splice(0);
  for (const entry of held) entry.gate.release();
  if (held.length === 0) return 'no request was being held';
  return held.map((entry) => entry.label + (entry.caught ? ': a held request went on' : ': no request matched, so nothing was held')).join('\\n');
}`;

function fail(spec: string | undefined, status: number) {
  const { label, code } = matcher(spec);
  return `async page => {
  ${ensure}
  context.porcelainFailed.push(await network.fail(${code}, ${status}));
  return 'answering ' + ${JSON.stringify(label)} + ' with ${status} until network restore';
}`;
}

const restore = `async page => {
  ${ensure}
  const failed = context.porcelainFailed.splice(0);
  for (const undo of failed) await undo();
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  return 'restored ' + failed.length + ' failing route' + (failed.length === 1 ? '' : 's') + ' and dispatched the window online event';
}`;

const drop = `async page => {
  ${ensure}
  const open = network.live.connected();
  network.live.drop();
  return (open ? 'dropped the live connection' : 'no live connection was open') + '; new live connections close until live restore';
}`;

const reconnect = `async page => {
  ${ensure}
  network.live.restore();
  const started = Date.now();
  while (!network.live.connected() && Date.now() - started < ${reconnectWithinMs}) await page.waitForTimeout(100);
  return network.live.connected() ? 'the live connection is back after ' + (Date.now() - started) + ' ms' : 'live connections may open again; none opened within ${reconnectWithinMs} ms';
}`;

function statusOf(value: string | undefined): number {
  if (value === undefined || !/^[1-5]\d\d$/.test(value))
    throw new Usage(
      'network fail needs --status <code>, such as --status 503.',
    );
  return Number(value);
}

export function networkCommand(
  run: Run,
  name: string,
  rest: readonly string[],
  values: { status?: string | undefined },
): string {
  const [action, spec] = rest;
  const code =
    name === 'live'
      ? action === 'drop'
        ? drop
        : action === 'restore'
          ? reconnect
          : undefined
      : action === 'hold'
        ? hold(spec)
        : action === 'release'
          ? release
          : action === 'fail'
            ? fail(spec, statusOf(values.status))
            : action === 'restore'
              ? restore
              : undefined;
  if (code === undefined)
    throw new Usage(
      name === 'live'
        ? 'Use live drop or live restore.'
        : 'Use network, network hold "<METHOD> <path>", network release, network fail "<METHOD> <path>" --status <code> or network restore.',
    );
  return `${run(code)}\n`;
}
