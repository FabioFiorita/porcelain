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
import { z } from 'zod';
import {
  probeSchema,
  type ProbeEdit,
  type ProbeGate,
} from '../architecture/probe.ts';

type LoadedProbe = z.output<typeof probeSchema> & { id: string };
type Planted = { touched: Set<string>; files: string[]; folders: string[] };
type Verdict = 'rejected' | 'NOT REJECTED' | 'STALE';
type Outcome = { verdict: Verdict; detail: string[] };

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const probeFolder = join(root, 'architecture', 'probes');
const gateScripts: Record<ProbeGate, string> = {
  lint: 'lint:server',
  arch: 'arch:check',
  typecheck: 'typecheck:server',
  test: 'test',
};
const moduleSchema = z.object({ default: probeSchema });

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
  return git(['status', '--porcelain', '--untracked-files=all']);
}

async function loadProbes(only: ReadonlySet<string>): Promise<LoadedProbe[]> {
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
  const unknown = [...only].filter(
    (id) => !probes.some((probe) => probe.id === id),
  );
  if (unknown.length > 0)
    throw new Error(`No probe is named ${unknown.join(', ')}.`);
  return only.size === 0
    ? probes
    : probes.filter((probe) => only.has(probe.id));
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
    const text = edited(readFileSync(path, 'utf8'), edit);
    planted.touched.add(edit.path);
    writeFileSync(path, text);
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

function runGate(gate: ProbeGate): Promise<{ status: number; output: string }> {
  return new Promise((done, fail) => {
    const child = spawn('pnpm', [gateScripts[gate]], { cwd: root });
    running = child;
    const chunks: Buffer[] = [];
    child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => chunks.push(chunk));
    child.on('error', fail);
    child.on('close', (status) => {
      running = undefined;
      done({
        status: status ?? 1,
        output: Buffer.concat(chunks).toString('utf8'),
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
    const { status, output } = await runGate(probe.gate);
    if (status !== 0 && output.includes(probe.rule))
      return { verdict: 'rejected', detail: [] };
    const lines = output.split('\n').filter((line) => line.trim() !== '');
    return {
      verdict: 'NOT REJECTED',
      detail: [
        status === 0
          ? `${gateScripts[probe.gate]} passed`
          : `${gateScripts[probe.gate]} failed without ${probe.rule}`,
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
  const pending = changedPaths();
  if (pending !== '')
    throw new Error(
      `Commit or discard every change first; the probes plant into this checkout and restore it with git checkout:\n${pending}`,
    );
  const probes = await loadProbes(new Set(process.argv.slice(2)));
  const { header, row } = table(probes);
  process.stdout.write(header);
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
