// Acts like a coding agent on a playground worktree, from outside the traced
// server process: its own Git commands never appear in traces. Real projects
// are never simulated on.
import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

export type SimulationAction =
  | 'edit'
  | 'add'
  | 'delete'
  | 'rename'
  | 'binary'
  | 'huge'
  | 'stage'
  | 'commit'
  | 'conflict'
  | 'abort-merge'
  | 'lock-index'
  | 'hide-worktree'
  | 'restore-worktree'
  | 'stream-start'
  | 'stream-stop';

export const simulationActions: {
  action: SimulationAction;
  title: string;
  detail: string;
  count?: boolean;
}[] = [
  {
    action: 'edit',
    title: 'Edit files',
    detail: 'Change a few lines in N tracked text files.',
    count: true,
  },
  {
    action: 'add',
    title: 'Add files',
    detail: 'Create N untracked files in a new folder.',
    count: true,
  },
  {
    action: 'delete',
    title: 'Delete files',
    detail: 'Delete N tracked files from disk.',
    count: true,
  },
  {
    action: 'rename',
    title: 'Rename files',
    detail: 'git mv N tracked files (staged renames).',
    count: true,
  },
  {
    action: 'binary',
    title: 'Change a binary',
    detail: 'Write a new PNG image.',
  },
  {
    action: 'huge',
    title: 'Write a 6 MB file',
    detail: 'Create a large generated text file.',
  },
  { action: 'stage', title: 'Stage everything', detail: 'git add -A.' },
  {
    action: 'commit',
    title: 'Commit everything',
    detail: 'git add -A && git commit, as the agent.',
  },
  {
    action: 'conflict',
    title: 'Start a merge conflict',
    detail: 'Leaves the worktree mid-merge with an unmerged file.',
  },
  {
    action: 'abort-merge',
    title: 'Abort the merge',
    detail: 'git merge --abort.',
  },
  {
    action: 'lock-index',
    title: 'Hold index.lock for 5 s',
    detail: 'Like an agent running git add at the same moment.',
  },
  {
    action: 'hide-worktree',
    title: 'Make the worktree unavailable',
    detail: 'Moves its directory away.',
  },
  {
    action: 'restore-worktree',
    title: 'Restore the worktree',
    detail: 'Moves the directory back.',
  },
  {
    action: 'stream-start',
    title: 'Keep editing',
    detail: 'Edit N files every second for 30 s, like an agent mid-turn.',
    count: true,
  },
  {
    action: 'stream-stop',
    title: 'Stop editing',
    detail: 'Stop the continuous edits.',
  },
];

const streams = new Map<string, NodeJS.Timeout>();

export function simulationEnvironment(root: string) {
  const clean = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !/^(GIT_|SSH_)/.test(key)),
  );
  return {
    ...clean,
    HOME: root,
    XDG_CONFIG_HOME: root,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_AUTHOR_NAME: 'Lab Agent',
    GIT_AUTHOR_EMAIL: 'agent@example.invalid',
    GIT_COMMITTER_NAME: 'Lab Agent',
    GIT_COMMITTER_EMAIL: 'agent@example.invalid',
  };
}

export async function simulate(
  root: string,
  worktree: string,
  action: SimulationAction,
  count = 5,
): Promise<string> {
  const env = simulationEnvironment(root);
  const git = async (...args: string[]) =>
    (await run('git', ['-C', worktree, ...args], { env, maxBuffer: 1 << 28 }))
      .stdout;
  const tracked = async () =>
    (await git('ls-files', '-z'))
      .split('\0')
      .filter((file) =>
        /\.(ts|tsx|js|mjs|md|css|json|yaml|yml|sql)$/.test(file),
      );
  // Spread the choice across the listing rather than taking a random sample,
  // so the same repository always produces the same simulated edit.
  const pick = (files: string[], n: number) => {
    const wanted = Math.min(n, files.length);
    const stride = Math.max(1, Math.floor(files.length / Math.max(1, wanted)));
    const chosen: string[] = [];
    for (let index = 0; chosen.length < wanted; index += stride)
      chosen.push(files[index % files.length] as string);
    return chosen;
  };
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');

  switch (action) {
    case 'edit':
      return `Edited ${(await editFiles(worktree, pick(await tracked(), count))).length} files.`;
    case 'add': {
      const folder = join(worktree, 'lab-agent', stamp);
      await mkdir(folder, { recursive: true });
      for (let index = 0; index < count; index++)
        await writeFile(
          join(folder, `note-${index + 1}.md`),
          `# Agent note ${index + 1}\n\n${lorem(12)}\n`,
        );
      return `Added ${count} untracked files under lab-agent/${stamp}.`;
    }
    case 'delete': {
      const files = pick(await tracked(), count);
      for (const file of files) await rm(join(worktree, file), { force: true });
      return `Deleted ${files.length} files.`;
    }
    case 'rename': {
      const files = pick(await tracked(), count);
      for (const file of files) {
        const target = file.replace(/(\.[^.]+)$/, `.renamed$1`);
        await git('mv', file, target);
      }
      return `Renamed ${files.length} files (staged).`;
    }
    case 'binary': {
      const target = join(worktree, 'assets', `lab-${stamp}.png`);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(
        target,
        Buffer.concat([
          Buffer.from('89504e470d0a1a0a', 'hex'),
          randomBytes(48 * 1024),
        ]),
      );
      return 'Wrote a 48 KB PNG.';
    }
    case 'huge': {
      const lines: string[] = [];
      while (lines.length < 90_000)
        lines.push(
          `export const generated${lines.length} = '${randomBytes(24).toString('hex')}';`,
        );
      await writeFile(
        join(worktree, `generated-${stamp}.ts`),
        `${lines.join('\n')}\n`,
      );
      return 'Wrote a 6 MB generated file.';
    }
    case 'stage':
      await git('add', '-A');
      return 'Staged everything.';
    case 'commit':
      await git('add', '-A');
      await git('commit', '-m', `Agent checkpoint ${stamp}`, '--allow-empty');
      return 'Committed everything.';
    case 'conflict': {
      const [file] = pick(await tracked(), 1);
      if (!file) return 'No tracked text file found.';
      if ((await git('status', '--porcelain', '--', file)).trim())
        return 'Picked a file with local changes; try again.';
      const original = await readFile(join(worktree, file), 'utf8');
      const branch = `lab-conflict-${stamp}`;
      await git('branch', branch);
      await writeFile(join(worktree, file), `// ours ${stamp}\n${original}`);
      await git(
        'commit',
        '-am',
        `Agent change on the working branch (${stamp})`,
      );
      // Their side, committed without touching this worktree.
      const theirs = await git('rev-parse', branch);
      const index = join(root, `lab-index-${stamp}`);
      const plumbing = { ...env, GIT_INDEX_FILE: index };
      const exec = async (...args: string[]) =>
        (
          await run('git', ['-C', worktree, ...args], { env: plumbing })
        ).stdout.trim();
      await exec('read-tree', theirs.trim());
      const blob = await new Promise<string>((resolve, reject) => {
        const child = execFile(
          'git',
          ['-C', worktree, 'hash-object', '-w', '--stdin'],
          { env: plumbing },
          (error, stdout) =>
            error ? reject(error) : resolve(String(stdout).trim()),
        );
        child.stdin?.end(`// theirs ${stamp}\n${original}`);
      });
      await exec('update-index', '--cacheinfo', `100644,${blob},${file}`);
      const tree = await exec('write-tree');
      const commit = await exec(
        'commit-tree',
        tree,
        '-p',
        theirs.trim(),
        '-m',
        'Other side',
      );
      await rm(index, { force: true });
      await git('update-ref', `refs/heads/${branch}`, commit);
      try {
        await git('merge', '--no-edit', branch);
      } catch {}
      return `Merging ${branch} left ${file} unmerged.`;
    }
    case 'abort-merge':
      await git('merge', '--abort');
      return 'Merge aborted.';
    case 'lock-index': {
      const gitDirectory = (
        await git('rev-parse', '--absolute-git-dir')
      ).trim();
      const lock = join(gitDirectory, 'index.lock');
      await writeFile(lock, '');
      setTimeout(() => void rm(lock, { force: true }), 5000).unref();
      return 'index.lock held for 5 s.';
    }
    case 'hide-worktree':
      await rename(worktree, `${worktree}.lab-hidden`);
      return 'Worktree directory moved away.';
    case 'restore-worktree':
      await rename(`${worktree}.lab-hidden`, worktree);
      return 'Worktree directory restored.';
    case 'stream-start': {
      clearInterval(streams.get(worktree));
      const files = await tracked();
      const started = Date.now();
      const timer = setInterval(() => {
        if (Date.now() - started > 30_000) {
          clearInterval(timer);
          streams.delete(worktree);
          return;
        }
        void editFiles(worktree, pick(files, count)).catch(() => {});
      }, 1000);
      streams.set(worktree, timer);
      return `Editing ${count} files every second for 30 s.`;
    }
    case 'stream-stop':
      clearInterval(streams.get(worktree));
      streams.delete(worktree);
      return 'Stopped editing.';
  }
}

export function stopAllStreams() {
  for (const timer of streams.values()) clearInterval(timer);
  streams.clear();
}

async function editFiles(worktree: string, files: string[]) {
  for (const file of files) {
    const path = join(worktree, file);
    const text = await readFile(path, 'utf8').catch(() => '');
    const lines = text.split('\n');
    const at = Math.floor(Math.random() * Math.max(1, lines.length));
    const comment = file.endsWith('.json')
      ? null
      : file.endsWith('.md')
        ? `Agent note: ${lorem(6)}`
        : `// agent: ${lorem(6)}`;
    if (comment) lines.splice(at, 0, comment);
    else lines.splice(Math.max(0, lines.length - 1), 0, '');
    await writeFile(path, lines.join('\n'));
  }
  return files;
}

const words =
  'review layer worktree status evidence comment agent diff history commit branch cache queue token file tree'.split(
    ' ',
  );
function lorem(count: number) {
  return Array.from(
    { length: count },
    () => words[Math.floor(Math.random() * words.length)],
  ).join(' ');
}
