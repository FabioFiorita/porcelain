import { execFile, spawn } from 'node:child_process';
import { cp, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';

const execute = promisify(execFile);

export const perfSample = {
  source: 'perf/sample.git',
  files: 30_000,
  filesPerFolder: 100,
  foldersPerModule: 20,
  linesPerFile: 30,
  commits: 3_000,
  filesPerCommit: 3,
  modified: 200,
  staged: 50,
  untracked: 50,
  worktrees: 3,
  commitsBetweenWorktrees: 25,
  projects: 3,
  projectWorktrees: 2,
  firstCommitSeconds: 1_767_225_600,
  secondsBetweenCommits: 3_600,
  bufferBytes: 1 << 20,
};

const author = 'Porcelain Sample <sample@example.invalid>';

type Git = (cwd: string, ...args: string[]) => Promise<unknown>;

export function perfSamplePath(index: number): string {
  const folder = Math.floor(index / perfSample.filesPerFolder);
  const module = Math.floor(folder / perfSample.foldersPerModule);
  return `src/module-${module}/part-${folder % perfSample.foldersPerModule}/file-${index}.ts`;
}

function content(index: number, revision: number): string {
  const lines = Array.from(
    { length: perfSample.linesPerFile },
    (_, line) =>
      `export const value${line} = ${(index * perfSample.linesPerFile + line) % 9973};`,
  );
  return `${lines.join('\n')}\nexport const revision = ${revision};\n`;
}

function data(text: string): string {
  return `data ${Buffer.byteLength(text)}\n${text}\n`;
}

function touched(commit: number, slot: number): number {
  return (commit * 7919 + slot * 104_729) % perfSample.files;
}

function* stream(): Generator<string> {
  for (let commit = 0; commit <= perfSample.commits; commit += 1) {
    const when =
      perfSample.firstCommitSeconds + commit * perfSample.secondsBetweenCommits;
    yield `commit refs/heads/main\nauthor ${author} ${when} +0000\ncommitter ${author} ${when} +0000\n`;
    yield data(
      commit === 0
        ? 'Add the sample modules'
        : `Revise sample module ${commit}`,
    );
    if (commit === 0)
      for (let index = 0; index < perfSample.files; index += 1)
        yield `M 100644 inline ${perfSamplePath(index)}\n${data(content(index, 0))}`;
    else
      for (let slot = 0; slot < perfSample.filesPerCommit; slot += 1) {
        const index = touched(commit, slot);
        yield `M 100644 inline ${perfSamplePath(index)}\n${data(content(index, commit))}`;
      }
    yield '\n';
  }
}

export async function buildPerfSample(output: string): Promise<void> {
  const source = join(output, perfSample.source);
  await mkdir(source, { recursive: true });
  const env = {
    PATH: process.env.PATH ?? '/usr/bin:/bin',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: '/dev/null',
  };
  await execute('git', ['init', '--quiet', '--bare', '-b', 'main', source], {
    env,
  });
  const importer = spawn('git', ['fast-import', '--quiet'], {
    cwd: source,
    env,
    stdio: ['pipe', 'ignore', 'pipe'],
  });
  let errors = '';
  importer.stderr.on('data', (chunk: Buffer) => {
    errors += chunk.toString('utf8');
  });
  const finished = new Promise<number | null>((resolveExit, rejectExit) => {
    importer.once('error', rejectExit);
    importer.once('close', resolveExit);
  });
  let pending = '';
  for (const piece of stream()) {
    pending += piece;
    if (pending.length < perfSample.bufferBytes) continue;
    if (!importer.stdin.write(pending))
      await new Promise((resolveDrain) =>
        importer.stdin.once('drain', resolveDrain),
      );
    pending = '';
  }
  importer.stdin.end(pending);
  const code = await finished;
  if (code !== 0)
    throw new Error(
      `git fast-import could not build the perf sample: ${errors}`,
    );
}

async function write(path: string, text: string) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, text);
}

export async function placePerfSample(input: {
  source: string;
  repository: string;
  git: Git;
}): Promise<void> {
  const { source, repository, git } = input;
  await cp(source, join(repository, '.git'), { recursive: true });
  await git(repository, 'config', '--bool', 'core.bare', 'false');
  await git(repository, 'checkout', '--quiet', '--force', 'main');
}

export async function changePerfSample(input: {
  root: string;
  repository: string;
  git: Git;
}): Promise<{ worktrees: string[]; projects: string[] }> {
  const { root, repository, git } = input;
  const worktrees = Array.from(
    { length: perfSample.worktrees },
    (_, index) => `worktrees/feature-${index}`,
  );
  for (const [index, worktree] of worktrees.entries())
    await git(
      repository,
      'worktree',
      'add',
      '--quiet',
      '-b',
      `feature-${index}`,
      join(root, worktree),
      `HEAD~${(index + 1) * perfSample.commitsBetweenWorktrees}`,
    );
  const changed = (offset: number, count: number) =>
    Array.from({ length: count }, (_, index) =>
      perfSamplePath((offset + index * 101) % perfSample.files),
    );
  for (const path of changed(0, perfSample.modified))
    await write(join(repository, path), `${content(0, -1)}// edited\n`);
  const staged = changed(perfSample.files / 2 + 1, perfSample.staged);
  for (const path of staged)
    await write(join(repository, path), `${content(1, -1)}// staged\n`);
  await git(repository, 'add', '--', ...staged);
  for (let index = 0; index < perfSample.untracked; index += 1)
    await write(
      join(repository, `src/drafts/draft-${index}.ts`),
      content(index, -1),
    );
  const projects = Array.from(
    { length: perfSample.projects },
    (_, index) => `projects/other-${index}`,
  );
  for (const project of projects) {
    const path = join(root, project);
    await mkdir(path, { recursive: true });
    await git(path, 'init', '--quiet', '-b', 'main');
    await write(join(path, 'README.md'), `# ${project}\n`);
    await git(path, 'add', 'README.md');
    await git(
      path,
      '-c',
      'user.name=Porcelain Sample',
      '-c',
      'user.email=sample@example.invalid',
      'commit',
      '--quiet',
      '-m',
      'Start the project',
    );
    for (let index = 0; index < perfSample.projectWorktrees; index += 1)
      await git(
        path,
        'worktree',
        'add',
        '--quiet',
        '-b',
        `topic-${index}`,
        join(root, `${project}-topic-${index}`),
      );
  }
  return { worktrees, projects };
}
