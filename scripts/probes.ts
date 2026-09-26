import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  rmdirSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs, stripVTControlCharacters } from 'node:util';
import { z } from 'zod';
import {
  liveRuleNames,
  probeSchema,
  unknownRule,
  unprobedRules,
  type ProbeEdit,
  type ProbeGate,
} from '../architecture/probe.ts';

type LoadedProbe = z.output<typeof probeSchema> & { id: string };
type Planted = { touched: Set<string>; files: string[]; folders: string[] };
type Verdict = 'rejected' | 'NOT REJECTED' | 'STALE';
type Outcome = { verdict: Verdict; detail: string[] };
type Shard = { index: number; count: number };
type Selection = { named: readonly string[]; shard: Shard | undefined };

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const probeFolder = join(root, 'architecture', 'probes');
const gateCommands: Record<
  ProbeGate,
  (probe: LoadedProbe) => readonly [string, ...string[]]
> = {
  lint: () => ['pnpm', 'lint:server'],
  'web-lint': () => ['pnpm', 'lint:web'],
  arch: () => ['pnpm', 'arch:check'],
  typecheck: () => ['pnpm', 'typecheck:server'],
  test: () => ['pnpm', 'test'],
  db: () => ['pnpm', 'db:check'],
  verify: (probe) => [
    'node',
    '.agents/skills/server-verify/scripts/verify.ts',
    probe.feature ?? '--all',
  ],
  'web-verify': (probe) => ['pnpm', 'verify:web', probe.feature ?? '--all'],
};
const expectedSeconds: Record<ProbeGate, (probe: LoadedProbe) => number> = {
  lint: () => 5,
  'web-lint': () => 7,
  arch: () => 4,
  typecheck: () => 3,
  test: () => 7,
  db: () => 2,
  verify: (probe) => (probe.feature === undefined ? 46 : 2),
  'web-verify': (probe) => (probe.feature === undefined ? 140 : 12),
};
const moduleSchema = z.object({ default: probeSchema });
const localEnvironment = Object.fromEntries(
  Object.entries(process.env).filter(([name]) => name !== 'CI'),
);

let running: ChildProcess | undefined;
let interrupted = false;

function git(args: readonly string[]): string {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
  return result.stdout;
}

function changedPaths(): string {
  return git(['status', '--porcelain', '--untracked-files=all'])
    .split('\n')
    .filter((line) => line !== '' && !line.startsWith('?? .claude/'))
    .join('\n');
}

async function loadProbes(): Promise<LoadedProbe[]> {
  const files = readdirSync(probeFolder)
    .filter((file) => file.endsWith('.ts'))
    .toSorted();
  const probes = await Promise.all(
    files.map(async (file) => {
      const loaded = moduleSchema.safeParse(
        await import(pathToFileURL(join(probeFolder, file)).href),
      );
      if (!loaded.success)
        throw new Error(
          `architecture/probes/${file} does not export a probe: ${loaded.error.message}`,
        );
      return { ...loaded.data.default, id: file.slice(0, -'.ts'.length) };
    }),
  );
  const names = await liveRuleNames(root);
  const dishonest = probes.flatMap((probe) => {
    const problem = unknownRule(probe, names);
    return problem ? [`architecture/probes/${probe.id}.ts: ${problem}`] : [];
  });
  if (dishonest.length > 0) throw new Error(dishonest.join('\n'));
  const unprobed = unprobedRules(probes, names);
  if (unprobed.length > 0)
    throw new Error(
      `Every rule has a probe that plants its violation; these have none: ${unprobed.join(', ')}`,
    );
  return probes;
}

function parsedShard(value: string): Shard {
  const match = /^([1-9]\d*)\/([1-9]\d*)$/.exec(value);
  const index = Number(match?.[1] ?? 0);
  const count = Number(match?.[2] ?? 0);
  if (index < 1 || index > count)
    throw new Error(
      `--shard takes <index>/<count> with 1 <= index <= count, such as 2/6; got ${JSON.stringify(value)}.`,
    );
  return { index, count };
}

function selection(args: readonly string[]): Selection {
  const { values, positionals } = parseArgs({
    args: [...args],
    options: { shard: { type: 'string', multiple: true } },
    allowPositionals: true,
    strict: true,
  });
  const shards = values.shard ?? [];
  if (shards.length > 1)
    throw new Error('--shard is given once; one run runs one shard.');
  const [shard] = shards;
  if (shard !== undefined && positionals.length > 0)
    throw new Error(
      'Name probes or give --shard, not both; a shard is a fixed share of every probe.',
    );
  return {
    named: positionals,
    shard: shard === undefined ? undefined : parsedShard(shard),
  };
}

function namedProbes(
  probes: readonly LoadedProbe[],
  named: readonly string[],
): LoadedProbe[] {
  const unknown = named.filter(
    (id) => !probes.some((probe) => probe.id === id),
  );
  if (unknown.length > 0)
    throw new Error(`No probe is named ${unknown.join(', ')}.`);
  return named.length === 0
    ? [...probes]
    : probes.filter((probe) => named.includes(probe.id));
}

function shardProbes(
  probes: readonly LoadedProbe[],
  shard: Shard,
): LoadedProbe[] {
  if (shard.count > probes.length)
    throw new Error(
      `--shard ${shard.index}/${shard.count} splits ${probes.length} probes into more shards than probes; every shard holds at least one.`,
    );
  const loads = Array.from({ length: shard.count }, () => 0);
  const members = new Set<string>();
  const byCost = probes
    .map((probe) => ({ probe, seconds: expectedSeconds[probe.gate](probe) }))
    .toSorted(
      (left, right) =>
        right.seconds - left.seconds ||
        left.probe.id.localeCompare(right.probe.id),
    );
  for (const { probe, seconds } of byCost) {
    const lightest = loads.indexOf(Math.min(...loads));
    loads[lightest] = (loads[lightest] ?? 0) + seconds;
    if (lightest === shard.index - 1) members.add(probe.id);
  }
  return probes.filter((probe) => members.has(probe.id));
}

function chosenProbes(
  probes: readonly LoadedProbe[],
  { named, shard }: Selection,
): { chosen: LoadedProbe[]; scope: string } {
  if (shard === undefined)
    return { chosen: namedProbes(probes, named), scope: '' };
  const chosen = shardProbes(probes, shard);
  return {
    chosen,
    scope: `Shard ${shard.index}/${shard.count}: ${chosen.length} of ${probes.length} probes.\n`,
  };
}

function missingFolders(path: string): string[] {
  const folders: string[] = [];
  for (
    let folder = dirname(path);
    !existsSync(folder);
    folder = dirname(folder)
  )
    folders.push(folder);
  return folders;
}

function edited(text: string, edit: ProbeEdit): string {
  if (edit.kind === 'append') return text + edit.content;
  if (edit.kind === 'prepend') return edit.content + text;
  if (edit.kind !== 'replace') return text;
  if (!text.includes(edit.old))
    throw new Error(
      `${edit.path} no longer holds the text the probe replaces: ${JSON.stringify(edit.old.slice(0, 80))}`,
    );
  return edit.all
    ? text.replaceAll(edit.old, edit.new)
    : text.replace(edit.old, edit.new);
}

function plant(edits: readonly ProbeEdit[], planted: Planted): void {
  for (const edit of edits) {
    const path = join(root, edit.path);
    if (edit.kind === 'create') {
      if (existsSync(path))
        throw new Error(`${edit.path} already exists; the probe creates it.`);
      planted.folders.push(...missingFolders(path));
      mkdirSync(dirname(path), { recursive: true });
      planted.files.push(path);
      writeFileSync(path, edit.content);
      continue;
    }
    if (!existsSync(path))
      throw new Error(`${edit.path} no longer exists; the probe edits it.`);
    planted.touched.add(edit.path);
    if (edit.kind === 'delete') {
      rmSync(path);
      continue;
    }
    writeFileSync(path, edited(readFileSync(path, 'utf8'), edit));
  }
}

function restore(planted: Planted): void {
  if (planted.touched.size > 0) git(['checkout', '--', ...planted.touched]);
  for (const file of planted.files) rmSync(file, { force: true });
  for (const folder of planted.folders) rmdirSync(folder);
  const left = changedPaths();
  if (left !== '')
    throw new Error(`The checkout is not clean after a probe:\n${left}`);
}

function runGate(
  command: readonly [string, ...string[]],
): Promise<{ status: number; output: string }> {
  return new Promise((done, fail) => {
    const [program, ...args] = command;
    const child = spawn(program, args, { cwd: root, env: localEnvironment });
    running = child;
    const chunks: Buffer[] = [];
    child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => chunks.push(chunk));
    child.on('error', fail);
    child.on('close', (status) => {
      running = undefined;
      done({
        status: status ?? 1,
        output: stripVTControlCharacters(
          Buffer.concat(chunks).toString('utf8'),
        ),
      });
    });
  });
}

async function attempt(probe: LoadedProbe): Promise<Outcome> {
  const planted: Planted = { touched: new Set(), files: [], folders: [] };
  try {
    plant(probe.edits, planted);
  } catch (error) {
    restore(planted);
    return {
      verdict: 'STALE',
      detail: [error instanceof Error ? error.message : String(error)],
    };
  }
  try {
    const command = gateCommands[probe.gate](probe);
    const { status, output } = await runGate(command);
    if (status !== 0 && output.includes(probe.rule))
      return { verdict: 'rejected', detail: [] };
    const lines = output.split('\n').filter((line) => line.trim() !== '');
    return {
      verdict: 'NOT REJECTED',
      detail: [
        status === 0
          ? `${command.join(' ')} passed`
          : `${command.join(' ')} failed without ${probe.rule}`,
        ...lines.slice(-12),
      ],
    };
  } finally {
    restore(planted);
  }
}

process.on('SIGINT', () => {
  interrupted = true;
  running?.kill('SIGINT');
});

function table(probes: readonly LoadedProbe[]) {
  const titles = ['probe', 'decision', 'gate', 'rule'] as const;
  const cells = (probe: LoadedProbe): readonly string[] => [
    probe.id,
    probe.decision,
    probe.gate,
    probe.rule,
  ];
  const widths = titles.map((title, index) =>
    Math.max(
      title.length,
      ...probes.map((probe) => cells(probe)[index]?.length ?? 0),
    ),
  );
  const line = (values: readonly string[], result: string) =>
    `${values.map((value, index) => value.padEnd(widths[index] ?? 0)).join('  ')}  ${result}\n`;
  return {
    header: line(titles, 'result'),
    row: (probe: LoadedProbe, result: string) => line(cells(probe), result),
  };
}

async function main(): Promise<number> {
  const selected = selection(process.argv.slice(2));
  const pending = changedPaths();
  if (pending !== '')
    throw new Error(
      `Commit or discard every change first; the probes plant into this checkout and restore it with git checkout:\n${pending}`,
    );
  const { chosen: probes, scope } = chosenProbes(await loadProbes(), selected);
  const { header, row } = table(probes);
  process.stdout.write(scope + header);
  let rejected = 0;
  for (const probe of probes) {
    if (interrupted) break;
    const outcome = await attempt(probe);
    if (outcome.verdict === 'rejected') rejected += 1;
    process.stdout.write(row(probe, outcome.verdict));
    for (const line of outcome.detail) process.stdout.write(`    ${line}\n`);
  }
  process.stdout.write(
    `${rejected} of ${probes.length} probes rejected${interrupted ? '; interrupted' : ''}.\n`,
  );
  return interrupted || rejected !== probes.length ? 1 : 0;
}

try {
  process.exitCode = await main();
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
}
