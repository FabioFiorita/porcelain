import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { ServerHandle, Recorder } from '@porcelain/server/kit/isolated-server';
import {
  sampleReview,
  toolCall,
  toolValue,
} from '@porcelain/server/kit/requests';
import { record, text } from '@porcelain/server/kit/session';

export async function archiveFixture(main: string) {
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
    body: 'Finished',
    baseRefName: 'main',
    headRefOid: head,
    mergeable: 'UNKNOWN',
    labels: { nodes: [], pageInfo: { hasNextPage: false } },
    comments: { nodes: [], pageInfo: { hasNextPage: false } },
    reviews: { nodes: [], pageInfo: { hasNextPage: false } },
  };
  const manifestPath = join(home, 'manifest.json');
  const manifest = record(JSON.parse(readFileSync(manifestPath, 'utf8')));
  const githubCommand = `#!${process.execPath}\nconst args=process.argv.slice(2);\nif(args[0]==='auth'&&args[1]==='status') console.log('["fixture"]');\nelse if(args[0]==='auth') console.log('fixture-credential');\nelse if(args.includes('repos/FabioFiorita/porcelain')) console.log('{}');\nelse console.log(JSON.stringify({data:{repository:{pullRequest:${JSON.stringify(pr)}}}}));\n`;
  const githubPath = join(text(manifest.bin), 'gh');
  const pullRequestUnavailable = (unavailable: boolean) =>
    writeFileSync(
      githubPath,
      unavailable
        ? githubCommand.replace(
            'else console.log',
            "else { console.error('HTTP 403 API rate limit exceeded'); process.exitCode = 1; }\nif (false) console.log",
          )
        : githubCommand,
      { mode: 0o755 },
    );
  pullRequestUnavailable(false);
  const server = await ServerHandle.attach(manifestPath);
  const session = server.session(new Recorder(), {
    projectId: '',
    worktreeId: '',
  });
  const body = {
    ...sampleReview(
      session,
      0,
      '75dc6a36-a001-4d00-b511-c45430b99403',
      '75dc6a36-a001-4d00-b511-c45430b99404',
    ),
    base: 'refs/heads/archive-base',
    pullRequest: pr.url,
  };
  const step = body.layers[0]?.steps[0];
  if (!step) throw new Error('Archive fixture needs a review step');
  step.pointer = {
    path: 'archive.txt',
    startLine: 1,
    endLine: 1,
  };
  const request = toolCall(session, 1, 'publish_review', body);
  request.headers = { ...request.headers, 'x-porcelain-cwd': tree };
  const result = await session.read(request);
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
    pullRequestUnavailable,
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
    reviewId: text(record(toolValue(result.body)).reviewId),
  };
}
