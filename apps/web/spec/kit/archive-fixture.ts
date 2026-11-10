import { execFileSync } from 'node:child_process';
import {
  readFileSync,
  writeFileSync,
  renameSync,
  mkdirSync,
  existsSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { ServerHandle, Recorder } from '@porcelain/server/kit/isolated-server';
import { record, text } from '@porcelain/server/kit/session';

export async function archiveFixture(
  main: string,
  options: { codeComment?: boolean; description?: string } = {},
) {
  const home = dirname(main);
  const tree = join(home, 'archive-fixture');
  const remote = join(home, 'archive-remote.git');
  const git = (...args: string[]) =>
    execFileSync('git', ['-C', main, ...args], { encoding: 'utf8' }).trim();
  execFileSync('git', ['init', '-q', '--bare', remote]);
  git('remote', 'add', 'origin', 'git@github.com:FabioFiorita/porcelain.git');
  git('remote', 'set-url', '--push', 'origin', remote);
  git('add', '--all');
  git('commit', '--allow-empty', '-qm', 'Prepare archive base');
  git('branch', 'archive-base');
  git('worktree', 'add', '-qb', 'archive-fixture', tree);
  writeFileSync(join(tree, 'archive.txt'), 'A completed change.\n');
  writeFileSync(join(tree, 'archive-notes.txt'), 'Archive fixture notes.\n');
  execFileSync('git', ['-C', tree, 'add', '--all']);
  execFileSync('git', [
    '-C',
    tree,
    'commit',
    '-qm',
    'Complete archive fixture',
  ]);
  execFileSync('git', ['-C', tree, 'push', '-qu', 'origin', 'archive-fixture']);
  writeFileSync(join(main, '.git/info/exclude'), 'node_modules/\n.env\n');
  writeFileSync(join(tree, '.env'), 'LOCAL_ONLY=archive-fixture\n');
  mkdirSync(join(tree, 'node_modules'));
  writeFileSync(join(tree, 'node_modules/ignored.js'), 'Ignored dependency');
  const head = git('rev-parse', 'archive-fixture');
  const pr = {
    number: 423,
    title: 'Completed archive fixture',
    url: 'https://github.com/FabioFiorita/porcelain/pull/423',
    state: 'MERGED',
    isDraft: false,
    author: { login: 'fixture' },
    headRefName: 'archive-fixture',
    updatedAt: '2026-10-21T03:00:00Z',
    commits: { nodes: [] },
    body: options.description ?? 'Finished',
    baseRefName: 'main',
    headRefOid: head,
    mergeable: 'UNKNOWN',
    labels: { nodes: [], pageInfo: { hasNextPage: false } },
    comments: { nodes: [], pageInfo: { hasNextPage: false } },
    reviews: {
      nodes: options.codeComment
        ? [
            {
              id: 'fixture-review',
              author: { login: 'fixture-reviewer' },
              submittedAt: '2026-10-21T03:00:00Z',
              body: 'Read the source file',
              url: 'https://github.com/FabioFiorita/porcelain/pull/423#pullrequestreview-1',
              state: 'COMMENTED',
              comments: {
                nodes: [
                  {
                    id: 'fixture-code-comment',
                    author: { login: 'fixture-reviewer' },
                    createdAt: '2026-10-21T03:00:00Z',
                    body: 'Keep the file scoped to this computer',
                    url: 'https://github.com/FabioFiorita/porcelain/pull/423#discussion_r1',
                    path: 'archive.txt',
                    line: 1,
                    originalLine: 1,
                    diffHunk: '@@ -0,0 +1 @@\n+A completed change.',
                  },
                ],
                pageInfo: { hasNextPage: false },
              },
            },
          ]
        : [],
      pageInfo: { hasNextPage: false },
    },
  };
  const manifestPath = join(home, 'manifest.json');
  const manifest = record(JSON.parse(readFileSync(manifestPath, 'utf8')));
  const githubCommand = `#!${process.execPath}\nconst args=process.argv.slice(2);\nif(args[0]==='auth'&&args[1]==='status') console.log('["fixture"]');\nelse if(args[0]==='auth') console.log('fixture-credential');\nelse if(args.includes('repos/FabioFiorita/porcelain')) console.log('{}');\nelse console.log(JSON.stringify({data:{repository:args.some(arg=>arg.includes('PullRequestList'))?{open:{nodes:[],pageInfo:{hasNextPage:false}},recent:{nodes:[${JSON.stringify(pr)}],pageInfo:{hasNextPage:false}}}:{pullRequest:${JSON.stringify(pr)}}}}));\n`;
  const githubPath = join(text(manifest.bin), 'gh');
  const setGitHubFailure = (
    reason: 'rate-limited' | 'not-found' | undefined,
  ) => {
    const replacement = `${githubPath}.next`;
    writeFileSync(
      replacement,
      reason !== undefined
        ? githubCommand.replace(
            'else console.log',
            `else { console.error(${JSON.stringify(reason === 'not-found' ? 'GraphQL: Could not resolve to a PullRequest with the number of 423.' : 'HTTP 403 API rate limit exceeded')}); process.exitCode = 1; }\nif (false) console.log`,
          )
        : githubCommand,
      { mode: 0o755 },
    );
    renameSync(replacement, githubPath);
  };
  setGitHubFailure(undefined);
  const server = await ServerHandle.attach(manifestPath);
  const session = server.session(new Recorder(), {
    projectId: '',
    worktreeId: '',
  });
  await session.read({
    method: 'PATCH',
    path: '/api/review-git-settings',
    body: {
      kind: 'initialize',
      settings: {
        pullStrategy: 'merge',
        collapseSpecs: false,
        archiveDeleteWorktree: true,
        archiveDeleteLocalBranch: true,
        archiveDeleteRemoteBranch: true,
      },
    },
  });
  return {
    relocateBranch: (destination: 'another-checkout' | 'not-checked-out') => {
      execFileSync('git', ['-C', tree, 'switch', '-c', 'former-pr-checkout']);
      writeFileSync(join(tree, 'archive.txt'), 'Different branch content.\n');
      execFileSync('git', ['-C', tree, 'add', 'archive.txt']);
      execFileSync('git', [
        '-C',
        tree,
        'commit',
        '-qm',
        'Change the former checkout',
      ]);
      if (destination === 'not-checked-out') return tree;
      const current = join(home, 'current-pr-checkout');
      git('worktree', 'add', current, 'archive-fixture');
      return current;
    },
    setGitHubFailure,
    lock: () => git('worktree', 'lock', tree),
    unlock: () => git('worktree', 'unlock', tree),
    dirty: () => writeFileSync(join(tree, 'unsaved.txt'), 'Unsaved work'),
    exists: () => existsSync(tree),
    ignoredFile: () => readFileSync(join(tree, '.env'), 'utf8'),
    remoteBranch: () =>
      execFileSync(
        'git',
        ['-C', remote, 'show-ref', '--verify', 'refs/heads/archive-fixture'],
        { encoding: 'utf8' },
      ),
    tree,
    remote,
    main,
  };
}
