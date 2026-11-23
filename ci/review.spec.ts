import { temporaryRoot } from '@porcelain/kernel/test-kit/temporary-root';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { withState } from './review-verdict.ts';

const head = 'a'.repeat(40);
const repository = 'owner/repo';
const reviewScript = new URL('./review.ts', import.meta.url);
const skipWait = `import { registerHooks } from 'node:module';
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'node:timers/promises' && context.parentURL === ${JSON.stringify(reviewScript.href)}) {
      return next('data:text/javascript,export async function setTimeout() {}', context);
    }
    return next(specifier, context);
  },
});`;

function landing(
  scenario:
    | 'blocked-once'
    | 'held-after-refusal'
    | 'merged-after-refusal'
    | 'pushed-after-refusal'
    | 'always-blocked'
    | 'forbidden',
) {
  const directory = mkdtempSync(join(temporaryRoot, 'porcelain-landing-'));
  const events = join(directory, 'events.json');
  try {
    writeFileSync(events, '[]');
    writeFileSync(
      join(directory, 'gh'),
      `#!${process.execPath}
const { readFileSync, writeFileSync } = require('node:fs');
const args = process.argv.slice(2);
const events = JSON.parse(readFileSync(${JSON.stringify(events)}, 'utf8'));
const record = (event) => {
  events.push(event);
  writeFileSync(${JSON.stringify(events)}, JSON.stringify(events));
};
const reply = (value) => console.log(JSON.stringify(value));
const blocked = events.includes('blocked');
const scenario = ${JSON.stringify(scenario)};
const head = ${JSON.stringify(head)};
if (args[0] === 'pr' && args[1] === 'view') {
  reply({
    number: 42, title: 'Change a feature', body: '',
    state: blocked && scenario === 'merged-after-refusal' ? 'MERGED' : 'OPEN',
    isDraft: false, baseRefName: 'main', baseRefOid: 'b'.repeat(40),
    headRefOid: blocked && scenario === 'pushed-after-refusal' ? 'c'.repeat(40) : head,
    headRefName: 'feature', changedFiles: 1,
    author: { login: 'owner' }, isCrossRepository: false,
    labels: blocked && scenario === 'held-after-refusal' ? [{ name: 'hold' }] : [],
  });
} else if (args.at(-1) === 'repos/owner/repo/issues/42/comments') {
  reply([[{ id: 1, user: { type: 'Bot' }, body: ${JSON.stringify(withState(undefined, { decision: { sha: head, needsOwner: false } }))} }]]);
} else if (args.at(-1) === 'repos/owner/repo/pulls/42/files') {
  reply([[{ filename: 'feature.ts' }]]);
} else if (args.at(-1) === 'repos/owner/repo/commits/' + head + '/check-runs') {
  reply([{ check_runs: [{ name: 'checks', status: 'completed', conclusion: 'success' }] }]);
} else if (args.includes('repos/owner/repo/issues/comments/1')) {
  reply({});
} else if (args.includes('repos/owner/repo/statuses/' + head)) {
  const status = JSON.parse(readFileSync(0, 'utf8'));
  record(status.context + ': ' + status.state);
} else if (JSON.stringify(args) === JSON.stringify(['pr', 'merge', '42', '--repo', 'owner/repo', '--squash', '--match-head-commit', head]) && process.env.GH_TOKEN === 'fixture-merge-token') {
  if (scenario === 'forbidden') {
    record('forbidden');
    console.error('GraphQL: Resource not accessible by personal access token');
    process.exitCode = 1;
  } else if (blocked && scenario !== 'always-blocked') {
    record('merged');
  } else {
    record('blocked');
    console.error('X Pull request owner/repo#42 is not mergeable: the base branch policy prohibits the merge.');
    console.error('To use administrator privileges to immediately merge the pull request, add the \`--admin\` flag.');
    process.exitCode = 1;
  }
} else {
  throw new Error('Unexpected GitHub request: ' + JSON.stringify(args));
}
`,
      { mode: 0o700 },
    );
    const result = spawnSync(
      process.execPath,
      [
        '--import',
        `data:text/javascript,${encodeURIComponent(skipWait)}`,
        fileURLToPath(reviewScript),
      ],
      {
        encoding: 'utf8',
        timeout: 8000,
        env: {
          PATH: directory,
          GITHUB_REPOSITORY: repository,
          PR_NUMBER: '42',
          HEAD_SHA: head,
          GITHUB_SERVER_URL: 'https://github.com',
          GITHUB_RUN_ID: '123',
          MERGE_TOKEN: 'fixture-merge-token',
        },
      },
    );
    if (result.error) throw result.error;
    return {
      status: result.status,
      events: JSON.parse(readFileSync(events, 'utf8')) as unknown,
      output: result.stdout,
    };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

describe('landing after a verdict', () => {
  const passingVerdict = ['Agent verdict: pending', 'Agent verdict: success'];

  it('merges the same head when GitHub clears its initial policy block', () => {
    const result = landing('blocked-once');
    expect(result.status).toBe(0);
    expect(result.events).toEqual([...passingVerdict, 'blocked', 'merged']);
    expect(result.output).toContain('### #42: merged');
  });

  it('stops when the pull request is held during the wait', () => {
    const result = landing('held-after-refusal');
    expect(result.status).toBe(0);
    expect(result.events).toEqual([
      ...passingVerdict,
      'blocked',
      'Agent verdict: success',
    ]);
    expect(result.output).toContain(
      '### #42: Ready, but the hold label keeps it from merging',
    );
  });

  it('leaves the verdict green when the same PR merges during the wait', () => {
    const result = landing('merged-after-refusal');
    expect(result.status).toBe(0);
    expect(result.events).toEqual([...passingVerdict, 'blocked']);
    expect(result.output).toContain('### #42: merged');
  });

  it('stops landing when a new head is pushed during the wait', () => {
    const result = landing('pushed-after-refusal');
    expect(result.status).toBe(0);
    expect(result.events).toEqual([
      ...passingVerdict,
      'blocked',
      'Agent verdict: failure',
    ]);
    expect(result.output).toContain(
      'The pull request changed before it could merge',
    );
  });

  it('reports a failed verdict once the policy block exhausts the retry budget', () => {
    const result = landing('always-blocked');
    expect(result.status).toBe(1);
    expect(result.events).toEqual([
      ...passingVerdict,
      'blocked',
      'blocked',
      'blocked',
      'blocked',
      'blocked',
      'Agent verdict: failure',
    ]);
    expect(result.output).toContain(
      '### #42: Merge still blocked after retries:',
    );
  });

  it('reports a permissions failure without trying again', () => {
    const result = landing('forbidden');
    expect(result.status).toBe(0);
    expect(result.events).toEqual([
      ...passingVerdict,
      'forbidden',
      'Agent verdict: failure',
    ]);
    expect(result.output).toContain(
      'Resource not accessible by personal access token',
    );
  });
});
