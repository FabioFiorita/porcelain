import { temporaryRoot } from '@porcelain/kernel/test-kit/temporary-root';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { withState } from './review-verdict.ts';

const head = 'a'.repeat(40);
const repository = 'owner/repo';

function landing(
  scenario: 'blocked-once' | 'held-after-refusal' | 'forbidden',
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
    number: 42, title: 'Change a feature', body: '', state: 'OPEN',
    isDraft: false, baseRefName: 'main', baseRefOid: 'b'.repeat(40),
    headRefOid: head, headRefName: 'feature', changedFiles: 1,
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
  } else if (blocked) {
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
      [fileURLToPath(new URL('./review.ts', import.meta.url))],
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
    expect(result.status, result.stderr).toBe(0);
    return { events: readFileSync(events, 'utf8'), output: result.stdout };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

describe('landing after a verdict', () => {
  it('merges the same head when GitHub clears its initial policy block', () => {
    const result = landing('blocked-once');
    expect(result.events).toBe(
      '["Agent verdict: pending","Agent verdict: success","blocked","merged"]',
    );
    expect(result.output).toContain('### #42: merged');
  });

  it('stops when the pull request is held during the wait', () => {
    const result = landing('held-after-refusal');
    expect(result.events).toBe(
      '["Agent verdict: pending","Agent verdict: success","blocked","Agent verdict: failure"]',
    );
    expect(result.output).toContain(
      'The pull request changed before it could merge',
    );
  });

  it('reports a permissions failure without trying again', () => {
    const result = landing('forbidden');
    expect(result.events).toBe(
      '["Agent verdict: pending","Agent verdict: success","forbidden","Agent verdict: failure"]',
    );
    expect(result.output).toContain(
      'Resource not accessible by personal access token',
    );
  });
});
