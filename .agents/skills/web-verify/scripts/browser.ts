import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

export const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../..',
);
const playwright = join(repositoryRoot, 'node_modules/.bin/playwright');
const idleLimitMs = 30 * 60 * 1000;
const idlePollMs = 30 * 1000;
const stopWithinMs = 20_000;

export class Refusal extends Error {}

const instanceBaseSchema = z.object({
  id: z.string(),
  pid: z.number(),
  evidence: z.string(),
  fingerprint: z.string(),
  startedAt: z.string(),
  lastCommandAt: z.number(),
  commands: z.number(),
  detail: z.unknown(),
});

export type Instance<Detail> = Omit<
  z.output<typeof instanceBaseSchema>,
  'detail'
> & { detail: Detail };

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

export function redacted(text: string): string {
  return text
    .replaceAll(/(\/pair#)[^\s'"]+/g, '$1[redacted]')
    .replaceAll(/(Bearer\s+)[^\s'"]+/gi, '$1[redacted]');
}

export function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function filesOf(path: string): string[] {
  const absolute = join(repositoryRoot, path);
  if (!existsSync(absolute)) return [];
  if (!statSync(absolute).isDirectory()) return [path];
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) =>
    entry.name === 'node_modules' || entry.name === 'dist'
      ? []
      : filesOf(join(path, entry.name)),
  );
}

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
    throw new Refusal(
      'Address the element with --role <role> --name <name>, --testid <id> or --text <text>.',
    );
  if (values.name === undefined) return `getByRole(${quoted(values.role)})`;
  return values.name.startsWith('/')
    ? `getByRole(${quoted(values.role)}, { name: ${quoted(values.name)} })`
    : `getByRole(${quoted(values.role)}, { name: ${quoted(values.name)}, exact: true })`;
}

export class Instances<Detail> {
  readonly home: string;
  private readonly surface: string;
  private readonly detail: z.ZodType<Detail>;
  private readonly watched: readonly string[];

  constructor(
    surface: string,
    detail: z.ZodType<Detail>,
    watched: readonly string[],
  ) {
    this.surface = surface;
    this.home = join(tmpdir(), `porcelain-${surface}-verify`);
    this.detail = detail;
    this.watched = watched;
  }

  private get folder(): string {
    return join(this.home, 'instances');
  }

  file(id: string): string {
    return join(this.folder, `${id}.json`);
  }

  evidenceFolder(id: string): string {
    return join(this.home, 'evidence', id);
  }

  session(instance: Pick<Instance<Detail>, 'id'>): string {
    return `${this.surface}-${instance.id}`;
  }

  private parsed(file: string): Instance<Detail> | undefined {
    const base = instanceBaseSchema.safeParse(
      JSON.parse(readFileSync(file, 'utf8')),
    );
    if (!base.success) return undefined;
    const detail = this.detail.safeParse(base.data.detail);
    return detail.success ? { ...base.data, detail: detail.data } : undefined;
  }

  saved(id: string): Instance<Detail> | undefined {
    return existsSync(this.file(id)) ? this.parsed(this.file(id)) : undefined;
  }

  live(): Instance<Detail>[] {
    if (!existsSync(this.folder)) return [];
    return readdirSync(this.folder)
      .filter((file) => file.endsWith('.json'))
      .flatMap((file) => {
        const instance = this.parsed(join(this.folder, file));
        return instance === undefined || !alive(instance.pid) ? [] : [instance];
      });
  }

  save(instance: Instance<Detail>): void {
    mkdirSync(this.folder, { recursive: true });
    writeFileSync(
      this.file(instance.id),
      `${JSON.stringify(instance, null, 2)}\n`,
    );
  }

  forget(id: string): void {
    rmSync(this.file(id), { force: true });
  }

  fingerprint(): string {
    const hash = createHash('sha256');
    for (const file of this.watched.flatMap(filesOf).toSorted()) {
      const stat = statSync(join(repositoryRoot, file));
      hash.update(`${file}\0${stat.size}\0${stat.mtimeMs}\n`);
    }
    return hash.digest('hex');
  }

  chosen(id: string | undefined): Instance<Detail> {
    const live = this.live();
    const names = live.map((instance) => instance.id).join(', ');
    if (id !== undefined) {
      const named = live.find((instance) => instance.id === id);
      if (named === undefined)
        throw new Refusal(
          `No live instance is named ${id}; live: ${names || 'none'}.`,
        );
      return named;
    }
    const [only, ...others] = live;
    if (only === undefined)
      throw new Refusal('No live instance; run start first.');
    if (others.length > 0)
      throw new Refusal(
        `Several instances are live (${names}); pass --instance <id>.`,
      );
    return only;
  }

  current(instance: Instance<Detail>, changed: string): void {
    if (instance.fingerprint !== this.fingerprint())
      throw new Refusal(
        `${changed} changed since instance ${instance.id} started; run start again so the evidence shows the code you changed.`,
      );
  }

  nextFile(instance: Instance<Detail>, name: string, extension: string) {
    return join(
      instance.evidence,
      `${String(instance.commands + 1).padStart(3, '0')}-${name}.${extension}`,
    );
  }

  record(
    instance: Instance<Detail>,
    name: string,
    args: readonly string[],
    output: string,
  ): string {
    const file = this.nextFile(instance, name, 'txt');
    writeFileSync(file, redacted(`$ cli ${args.join(' ')}\n\n${output}`));
    this.save({
      ...instance,
      commands: instance.commands + 1,
      lastCommandAt: Date.now(),
    });
    return file;
  }

  async supervise(
    script: string,
    id: string,
    args: readonly string[],
    readyWithinMs: number,
  ): Promise<number> {
    const evidence = this.evidenceFolder(id);
    mkdirSync(evidence, { recursive: true });
    mkdirSync(this.folder, { recursive: true });
    const started = performance.now();
    const log = openSync(join(evidence, 'supervisor.log'), 'a');
    const supervisor = spawn(process.execPath, [script, 'serve', id, ...args], {
      cwd: repositoryRoot,
      detached: true,
      stdio: ['ignore', log, log],
    });
    supervisor.unref();
    const deadline = Date.now() + readyWithinMs;
    while (!existsSync(this.file(id))) {
      if (
        supervisor.pid === undefined ||
        !alive(supervisor.pid) ||
        Date.now() > deadline
      ) {
        const failed = join(evidence, 'start-failed.txt');
        throw new Refusal(
          `Instance ${id} did not start: ${existsSync(failed) ? readFileSync(failed, 'utf8').split('\n')[0] : 'read the supervisor log'}. Evidence: ${evidence}`,
        );
      }
      await sleep(100);
    }
    return Math.round(performance.now() - started);
  }

  async idle(id: string, evidence: string, stop: () => Promise<void>) {
    for (;;) {
      await sleep(idlePollMs);
      const saved = this.saved(id);
      if (
        saved === undefined ||
        Date.now() - saved.lastCommandAt > idleLimitMs
      ) {
        writeFileSync(
          join(evidence, 'idle-stop.txt'),
          `No command reached instance ${id} for 30 minutes; it stopped itself.\n`,
        );
        await stop();
      }
    }
  }

  async stop(instance: Instance<Detail>): Promise<string> {
    process.kill(instance.pid, 'SIGTERM');
    const deadline = Date.now() + stopWithinMs;
    while (alive(instance.pid) && Date.now() < deadline) await sleep(100);
    if (alive(instance.pid))
      throw new Refusal(
        `Instance ${instance.id} (pid ${instance.pid}) did not stop in 20 seconds; the evidence stays in ${instance.evidence}.`,
      );
    return `stopped ${instance.id}\nevidence ${instance.evidence}\n`;
  }

  listing(instance: Instance<Detail>): string {
    return `${instance.evidence}\n${readdirSync(instance.evidence)
      .toSorted()
      .map((file) => `  ${file}`)
      .join('\n')}\n`;
  }

  browser(
    instance: Pick<Instance<Detail>, 'id' | 'evidence'>,
    args: readonly string[],
  ): string {
    const result = spawnSync(
      playwright,
      ['cli', `-s=${this.session(instance)}`, ...args],
      {
        cwd: instance.evidence,
        encoding: 'utf8',
        maxBuffer: 256 * 1024 * 1024,
      },
    );
    if (result.error) throw result.error;
    const output = `${result.stdout}${result.stderr}`;
    if (result.status !== 0)
      throw new Refusal(
        output.trim() || `playwright cli ${args[0] ?? ''} failed`,
      );
    return output;
  }

  interact(
    instance: Instance<Detail>,
    origin: string,
    name: string | undefined,
    rest: readonly string[],
    values: Address,
    args: readonly string[],
  ): string | undefined {
    if (name === 'open') {
      const route = rest[0] ?? '/';
      return `${this.browser(instance, ['goto', `${origin}${route.startsWith('/') ? route : `/${route}`}`])}\nrecorded ${this.record(instance, 'open', args, '')}\n`;
    }
    if (name === 'click' || name === 'fill') {
      const target = address(values);
      const output =
        name === 'click'
          ? this.browser(instance, [
              'click',
              target,
              ...(values.button === undefined ? [] : [values.button]),
            ])
          : this.browser(instance, ['fill', target, rest[0] ?? '']);
      return `${output}\nrecorded ${this.record(instance, name, args, output)}\n`;
    }
    if (name === 'press') {
      const output = this.browser(instance, ['press', rest[0] ?? 'Enter']);
      return `${output}\nrecorded ${this.record(instance, 'press', args, output)}\n`;
    }
    if (name === 'snapshot') {
      const file = this.nextFile(instance, 'snapshot', 'yml');
      const tree = redacted(
        z
          .string()
          .parse(
            JSON.parse(
              this.browser(instance, [
                '--raw',
                'run-code',
                "async page => page.locator('body').ariaSnapshot()",
              ]),
            ),
          ),
      );
      writeFileSync(file, `${tree}\n`);
      this.record(instance, 'snapshot', args, `aria snapshot in ${file}\n`);
      return `${tree}\nrecorded ${file}\n`;
    }
    if (name === 'screenshot') {
      const file = this.nextFile(instance, 'screenshot', 'png');
      this.browser(instance, ['screenshot', '--filename', file]);
      this.record(instance, 'screenshot', args, `screenshot in ${file}\n`);
      return `recorded ${file}\n`;
    }
    if (name === 'console' || name === 'network') {
      const output = this.browser(instance, [
        '--raw',
        name === 'console' ? 'console' : 'requests',
      ]);
      return `${redacted(output)}\nrecorded ${this.record(instance, name, args, output)}\n`;
    }
    if (name === 'trace' && rest[0] === 'start') {
      this.browser(instance, [
        '--raw',
        'run-code',
        'async page => { await page.context().browser().startTracing(page, { screenshots: true }); return "tracing"; }',
      ]);
      return `tracing\nrecorded ${this.record(instance, 'trace-start', args, 'Chrome performance trace started\n')}\n`;
    }
    if (name === 'trace' && rest[0] === 'stop') {
      const encoded = this.browser(instance, [
        '--raw',
        'run-code',
        'async page => (await page.context().browser().stopTracing()).toString("base64")',
      ]);
      const file = this.nextFile(instance, 'trace', 'json');
      writeFileSync(
        file,
        Buffer.from(z.string().parse(JSON.parse(encoded)), 'base64'),
      );
      this.record(
        instance,
        'trace-stop',
        args,
        `Chrome performance trace in ${file}; open it in the Performance panel of Chrome DevTools\n`,
      );
      return `recorded ${file}\n`;
    }
    return undefined;
  }
}

export async function runCli(
  command: (args: readonly string[]) => Promise<string>,
): Promise<void> {
  try {
    process.stdout.write(await command(process.argv.slice(2)));
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = error instanceof Refusal ? 2 : 1;
  }
}
