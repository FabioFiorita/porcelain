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
import { networkCommand } from './network.ts';

const playwright = join(repositoryRoot, 'node_modules/.bin/playwright');
const appearWithinMs = 10_000;

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
  'within-role': { type: 'string' },
  'within-name': { type: 'string' },
  nth: { type: 'string' },
  frame: { type: 'string' },
  'to-role': { type: 'string' },
  'to-name': { type: 'string' },
  'to-testid': { type: 'string' },
  'to-text': { type: 'string' },
  timeout: { type: 'string' },
  status: { type: 'string' },
} as const;

export const interactionUsage = `  open <route>            open a route of the web app
  back                    go back in the browser history
  click <address> [--button right]
  fill <address> <value>  fill a field; the file editor's text is replaced
  press <key>             press a key, such as Escape or ControlOrMeta+p
  drag <address> <to>     drag onto --to-role <role> --to-name <name>, --to-testid or --to-text
  wait <address>          wait until the element shows, up to --timeout <ms> (10000)
      An address is --role <role> --name <name>, --testid <id> or --text <text>,
      scoped by --within-role <role> --within-name <name>, --frame "<iframe title>"
      and --nth <index>; click, fill and drag first wait for it like wait does.
  snapshot                record the accessibility tree as Playwright's aria snapshot
  screenshot              record a screenshot
  console                 record the console messages
  network                 record the requests the page sent
  network hold "<METHOD> <path>" | release
                          hold the next matching request until release
  network fail "<METHOD> <path>" --status <code> | restore
                          answer matching requests with the status until restore
  live drop | restore     cut the live connection and let it reconnect
  trace start|stop        record a Chrome performance trace through CDP
`;

type Address = {
  role?: string | undefined;
  name?: string | undefined;
  testid?: string | undefined;
  text?: string | undefined;
};

export type Interaction = Address & {
  button?: string | undefined;
  'within-role'?: string | undefined;
  'within-name'?: string | undefined;
  nth?: string | undefined;
  frame?: string | undefined;
  'to-role'?: string | undefined;
  'to-name'?: string | undefined;
  'to-testid'?: string | undefined;
  'to-text'?: string | undefined;
  timeout?: string | undefined;
  status?: string | undefined;
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

function byRole(role: string, name: string | undefined): string {
  if (name === undefined) return `getByRole(${quoted(role)})`;
  return name.startsWith('/')
    ? `getByRole(${quoted(role)}, { name: ${quoted(name)} })`
    : `getByRole(${quoted(role)}, { name: ${quoted(name)}, exact: true })`;
}

function address(values: Address, flag = ''): string {
  if (values.testid !== undefined)
    return `getByTestId(${quoted(values.testid)})`;
  if (values.text !== undefined)
    return values.text.startsWith('/')
      ? `getByText(${quoted(values.text)})`
      : `getByText(${quoted(values.text)}, { exact: true })`;
  if (values.role === undefined)
    throw new Usage(
      `Address the element with --${flag}role <role> --${flag}name <name>, --${flag}testid <id> or --${flag}text <text>.`,
    );
  return byRole(values.role, values.name);
}

function count(value: string | undefined, flag: string, fallback: number) {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(value))
    throw new Usage(`--${flag} takes a whole number, not ${value}.`);
  return Number(value);
}

function target(values: Interaction): string {
  const frame =
    values.frame === undefined
      ? ''
      : `locator(${quoted(`iframe[title=${JSON.stringify(values.frame)}]`)}).contentFrame().`;
  const within =
    values['within-role'] === undefined
      ? ''
      : `${byRole(values['within-role'], values['within-name'])}.`;
  const nth =
    values.nth === undefined ? '' : `.nth(${count(values.nth, 'nth', 0)})`;
  return `${frame}${within}${address(values)}${nth}`;
}

function dropTarget(values: Interaction): string {
  return address(
    {
      role: values['to-role'],
      name: values['to-name'],
      testid: values['to-testid'],
      text: values['to-text'],
    },
    'to-',
  );
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

export function runCode(session: string, cwd: string, code: string): string {
  return z
    .string()
    .parse(
      JSON.parse(playwrightCli(session, cwd, ['--raw', 'run-code', code])),
    );
}

export async function recorded(
  browser: Browser,
  name: string,
  args: readonly string[],
  output: string,
): Promise<string> {
  const file = await browser.evidence.record(name, args, output);
  return `${browser.redactor.text(output)}\nrecorded ${file}\n`;
}

async function appear(
  browser: Browser,
  name: string,
  args: readonly string[],
  locator: string,
  values: Interaction,
): Promise<number> {
  const withinMs = count(values.timeout, 'timeout', appearWithinMs);
  const started = Date.now();
  try {
    runCode(
      browser.session,
      browser.cwd,
      `async page => { await page.${locator}.first().waitFor({ state: 'visible', timeout: ${withinMs} }); return 'visible'; }`,
    );
  } catch (error) {
    const reason = (error instanceof Error ? error.message : String(error))
      .split('\n')
      .find((line) => /^\w*Error: /.test(line));
    const message = `${locator} did not show within ${withinMs} ms${reason === undefined ? '' : `: ${reason}`}`;
    await browser.evidence.record(name, args, `${message}\n`);
    throw new Refusal(message);
  }
  return Date.now() - started;
}

function fillCode(locator: string, value: string): string {
  const text = JSON.stringify(value);
  return `async page => {
  const field = page.${locator};
  if (await field.evaluate((element) => element.isContentEditable)) {
    await field.press('ControlOrMeta+a');
    await page.keyboard.insertText(${text});
  } else await field.fill(${text});
  return 'filled';
}`;
}

async function run(
  browser: Browser,
  name: string | undefined,
  rest: readonly string[],
  values: Interaction,
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
  if (name === 'back') return recorded(browser, 'back', args, cli(['go-back']));
  if (name === 'click') {
    const locator = target(values);
    await appear(browser, 'click', args, locator, values);
    return recorded(
      browser,
      'click',
      args,
      cli([
        'click',
        locator,
        ...(values.button === undefined ? [] : [values.button]),
      ]),
    );
  }
  if (name === 'fill') {
    const locator = target(values);
    await appear(browser, 'fill', args, locator, values);
    return recorded(
      browser,
      'fill',
      args,
      cli(['run-code', fillCode(locator, rest[0] ?? '')]),
    );
  }
  if (name === 'drag') {
    const from = target(values);
    const to = dropTarget(values);
    await appear(browser, 'drag', args, from, values);
    await appear(browser, 'drag', args, to, values);
    return recorded(browser, 'drag', args, cli(['drag', from, to]));
  }
  if (name === 'wait') {
    const locator = target(values);
    const tookMs = await appear(browser, 'wait', args, locator, values);
    return recorded(
      browser,
      'wait',
      args,
      `${locator} showed after ${tookMs} ms\n`,
    );
  }
  if (name === 'press')
    return recorded(browser, 'press', args, cli(['press', rest[0] ?? 'Enter']));
  if ((name === 'network' && rest[0] !== undefined) || name === 'live')
    return recorded(
      browser,
      `${name}-${rest[0] ?? ''}`,
      args,
      networkCommand(
        (code) => runCode(browser.session, browser.cwd, code),
        name,
        rest,
        values,
      ),
    );
  if (name === 'console' || name === 'network')
    return recorded(
      browser,
      name,
      args,
      cli(['--raw', name === 'console' ? 'console' : 'requests']),
    );
  if (name === 'snapshot') {
    const tree = runCode(
      browser.session,
      browser.cwd,
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
      browser.session,
      browser.cwd,
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
      browser.session,
      browser.cwd,
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
  values: Interaction,
  args: readonly string[],
): Promise<string | undefined> {
  const started = Date.now();
  try {
    return await run(browser, name, rest, values, args);
  } finally {
    await browser.evidence.scrub(started);
  }
}
