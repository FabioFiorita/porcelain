import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { z } from 'zod';
import { Refusal, Usage } from '../../server-verify/scripts/core/cli.ts';
import type {
  Evidence,
  Redactor,
} from '../../server-verify/scripts/core/evidence.ts';
import type { BuildInputs } from '../../server-verify/scripts/core/fingerprint.ts';
import { repositoryRoot } from '../../server-verify/scripts/core/registry.ts';

const playwright = join(repositoryRoot, 'node_modules/.bin/playwright');

export const webInputs: BuildInputs = {
  roots: [
    'apps/web/src',
    'apps/web/public',
    'apps/web/index.html',
    'apps/web/vite.config.ts',
  ],
  apps: ['apps/web'],
};

export const interactionOptions = {
  instance: { type: 'string' },
  role: { type: 'string' },
  name: { type: 'string' },
  testid: { type: 'string' },
  text: { type: 'string' },
  button: { type: 'string' },
} as const;

export const interactionUsage = `  open <route>            open a route of the web app
  click <address> [--button right]
  fill <address> <value>  address is --role <role> --name <name>, --testid <id> or --text <text>
  press <key>             press a key, such as Escape or ControlOrMeta+p
  snapshot                record the accessibility tree as Playwright's aria snapshot
  screenshot              record a screenshot
  console                 record the console messages
  network                 record the requests the page sent
  trace start|stop        record a Chrome performance trace through CDP
`;

type Address = {
  role?: string | undefined;
  name?: string | undefined;
  testid?: string | undefined;
  text?: string | undefined;
  button?: string | undefined;
};

export type Browser = {
  session: string;
  cwd: string;
  origin: string;
  evidence: Evidence;
  redactor: Redactor;
};

function quoted(value: string): string {
  return /^\/.+\/[a-z]*$/.test(value)
    ? value
    : `'${value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
}

function address(values: Address): string {
  if (values.testid !== undefined)
    return `getByTestId(${quoted(values.testid)})`;
  if (values.text !== undefined)
    return values.text.startsWith('/')
      ? `getByText(${quoted(values.text)})`
      : `getByText(${quoted(values.text)}, { exact: true })`;
  if (values.role === undefined)
    throw new Usage(
      'Address the element with --role <role> --name <name>, --testid <id> or --text <text>.',
    );
  if (values.name === undefined) return `getByRole(${quoted(values.role)})`;
  return values.name.startsWith('/')
    ? `getByRole(${quoted(values.role)}, { name: ${quoted(values.name)} })`
    : `getByRole(${quoted(values.role)}, { name: ${quoted(values.name)}, exact: true })`;
}

export function daemonMarker(session: string): string {
  return `cliDaemon.js ${session}`;
}

export function playwrightCli(
  session: string,
  cwd: string,
  args: readonly string[],
): string {
  const result = spawnSync(playwright, ['cli', `-s=${session}`, ...args], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  const output = `${result.stdout}${result.stderr}`;
  if (result.status !== 0)
    throw new Refusal(
      output.trim() || `playwright cli ${args[0] ?? ''} failed`,
    );
  return output;
}

function runCode(browser: Browser, code: string): string {
  return z
    .string()
    .parse(
      JSON.parse(
        playwrightCli(browser.session, browser.cwd, [
          '--raw',
          'run-code',
          code,
        ]),
      ),
    );
}

async function recorded(
  browser: Browser,
  name: string,
  args: readonly string[],
  output: string,
): Promise<string> {
  const file = await browser.evidence.record(name, args, output);
  return `${browser.redactor.text(output)}\nrecorded ${file}\n`;
}

async function run(
  browser: Browser,
  name: string | undefined,
  rest: readonly string[],
  values: Address,
  args: readonly string[],
): Promise<string | undefined> {
  const cli = (command: readonly string[]) =>
    playwrightCli(browser.session, browser.cwd, command);
  if (name === 'open') {
    const route = rest[0] ?? '/';
    const output = cli([
      'goto',
      `${browser.origin}${route.startsWith('/') ? route : `/${route}`}`,
    ]);
    return recorded(browser, 'open', args, output);
  }
  if (name === 'click')
    return recorded(
      browser,
      'click',
      args,
      cli([
        'click',
        address(values),
        ...(values.button === undefined ? [] : [values.button]),
      ]),
    );
  if (name === 'fill')
    return recorded(
      browser,
      'fill',
      args,
      cli(['fill', address(values), rest[0] ?? '']),
    );
  if (name === 'press')
    return recorded(browser, 'press', args, cli(['press', rest[0] ?? 'Enter']));
  if (name === 'console' || name === 'network')
    return recorded(
      browser,
      name,
      args,
      cli(['--raw', name === 'console' ? 'console' : 'requests']),
    );
  if (name === 'snapshot') {
    const tree = runCode(
      browser,
      "async page => page.locator('body').ariaSnapshot()",
    );
    const claimed = await browser.evidence.claim('snapshot', 'txt');
    const file = await browser.evidence.attach(claimed, 'yml', `${tree}\n`);
    await browser.evidence.write(claimed, args, `aria snapshot in ${file}\n`);
    return `${browser.redactor.known(tree)}\nrecorded ${file}\n`;
  }
  if (name === 'screenshot') {
    const claimed = await browser.evidence.claim('screenshot', 'txt');
    const file = browser.evidence.sibling(claimed, 'png');
    cli(['screenshot', '--filename', file]);
    await browser.evidence.write(claimed, args, `screenshot in ${file}\n`);
    return `recorded ${file}\n`;
  }
  if (name === 'trace' && rest[0] === 'start') {
    runCode(
      browser,
      'async page => { await page.context().browser().startTracing(page, { screenshots: true }); return "tracing"; }',
    );
    return recorded(
      browser,
      'trace-start',
      args,
      'Chrome performance trace started\n',
    );
  }
  if (name === 'trace' && rest[0] === 'stop') {
    const encoded = runCode(
      browser,
      'async page => (await page.context().browser().stopTracing()).toString("base64")',
    );
    const claimed = await browser.evidence.claim('trace', 'txt');
    const file = await browser.evidence.attach(
      claimed,
      'json',
      Buffer.from(encoded, 'base64').toString('utf8'),
    );
    await browser.evidence.write(
      claimed,
      args,
      `Chrome performance trace in ${file}; open it in the Performance panel of Chrome DevTools\n`,
    );
    return `recorded ${file}\n`;
  }
  return undefined;
}

export async function interact(
  browser: Browser,
  name: string | undefined,
  rest: readonly string[],
  values: Address,
  args: readonly string[],
): Promise<string | undefined> {
  const started = Date.now();
  try {
    return await run(browser, name, rest, values, args);
  } finally {
    await browser.evidence.scrub(started);
  }
}
