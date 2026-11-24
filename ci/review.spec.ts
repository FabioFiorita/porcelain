import { temporaryRoot } from '@porcelain/kernel/test-kit/temporary-root';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vite-plus/test';
import { savedState, withState } from './review-verdict.ts';

const head = 'a'.repeat(40);
const repository = 'owner/repo';
const reviewScript = new URL('./review.ts', import.meta.url);
const markWait = `import { writeFileSync } from 'node:fs';
export async function setTimeout() {
  writeFileSync(process.env.MERGE_WAIT_MARKER, '');
}`;
const skipWait = `import { registerHooks } from 'node:module';
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'node:timers/promises' && context.parentURL === ${JSON.stringify(reviewScript.href)}) {
      return next(${JSON.stringify(`data:text/javascript,${encodeURIComponent(markWait)}`)}, context);
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
    | 'forbidden'
    | 'label-with-active-ci'
    | 'ready-with-active-ci'
    | 'ci-starts-before-first-merge'
    | 'ci-starts-before-retry'
    | 'ci-starts-during-retry'
    | 'fork-ci-active'
    | 'other-pr-ci-active'
    | 'deleted-fork'
    | 'branch-renamed-after-ci'
    | 'ci-never-ran'
    | 'workflow-ci-completed'
    | 'workflow-ci-overlap'
    | 'workflow-ci-cancelled'
    | 'workflow-ci-failed'
    | 'workflow-failed-check-green'
    | 'workflow-old-cancel-latest-green',
) {
  const directory = mkdtempSync(join(temporaryRoot, 'porcelain-landing-'));
  const events = join(directory, 'events.json');
  const comment = join(directory, 'comment');
  const waitMarker = join(directory, 'waited');
  try {
    writeFileSync(events, '[]');
    writeFileSync(comment, '');
    writeFileSync(
      join(directory, 'gh'),
      `#!${process.execPath}
const { existsSync, readFileSync, writeFileSync } = require('node:fs');
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
const branch = scenario === 'branch-renamed-after-ci' ? 'feature-renamed' : 'feature';
if (args[0] === 'pr' && args[1] === 'view') {
  reply({
    number: 42, title: 'Change a feature', body: '',
    state: blocked && scenario === 'merged-after-refusal' ? 'MERGED' : 'OPEN',
    isDraft: false, baseRefName: 'main', baseRefOid: 'b'.repeat(40),
    headRefOid: blocked && scenario === 'pushed-after-refusal' ? 'c'.repeat(40) : head,
    headRefName: branch, headRepository: scenario === 'deleted-fork' ? null : { nameWithOwner: 'owner/repo' }, changedFiles: 1,
    author: { login: 'owner' }, isCrossRepository: scenario === 'deleted-fork',
    labels: blocked && scenario === 'held-after-refusal' ? [{ name: 'hold' }] : [],
  });
} else if (args.at(-1) === 'repos/owner/repo/pulls?state=open&head=owner%3Afeature') {
  reply([[{ number: 42, head: { sha: head }, base: { ref: 'main' } }]]);
} else if (args.at(-1) === 'repos/owner/repo/actions/workflows/ci.yml/runs?event=pull_request&head_sha=' + head + '&branch=' + branch) {
  if (scenario === 'deleted-fork') throw new Error('A deleted fork has no CI lookup.');
  if (['branch-renamed-after-ci', 'ci-never-ran'].includes(scenario)) {
    reply([{ workflow_runs: [] }]);
    process.exit(0);
  }
  const active = ['label-with-active-ci', 'ready-with-active-ci', 'fork-ci-active', 'other-pr-ci-active', 'workflow-ci-overlap'].includes(scenario)
    || (scenario === 'ci-starts-before-first-merge' && events.includes('Agent verdict: success'))
    || (scenario === 'ci-starts-before-retry' && blocked)
    || (scenario === 'ci-starts-during-retry' && blocked && existsSync(${JSON.stringify(waitMarker)}));
  const activeRun = {
    id: 3, run_attempt: 1, run_started_at: null, created_at: '2026-11-24T01:30:56Z',
    status: scenario === 'ready-with-active-ci' ? 'queued' : 'in_progress',
    conclusion: null,
    head_repository: { full_name: scenario === 'fork-ci-active' ? 'fork/repo' : 'owner/repo' },
    pull_requests: scenario === 'other-pr-ci-active' ? [{ number: 43 }] : [],
  };
  const completed = (id, conclusion) => ({
    id, run_attempt: scenario === 'workflow-ci-cancelled' ? 2 : 1,
    run_started_at: '2026-11-24T01:' + (id === 1 ? '10' : '20') + ':00Z',
    created_at: '2026-11-24T01:00:00Z',
    status: 'completed', conclusion, head_repository: { full_name: 'owner/repo' },
    pull_requests: [{ number: 42 }],
  });
  reply([{ workflow_runs: [
    completed(1, ['workflow-ci-cancelled', 'workflow-old-cancel-latest-green'].includes(scenario) ? 'cancelled' : 'success'),
    ...(scenario === 'workflow-ci-failed' ? [completed(2, 'failure')] : []),
    ...(scenario === 'workflow-failed-check-green' ? [completed(2, 'failure')] : []),
    ...(scenario === 'workflow-old-cancel-latest-green' ? [completed(2, 'success')] : []),
    ...(active ? [activeRun] : []),
  ] }]);
} else if (args.at(-1) === 'repos/owner/repo/actions/runs/1/attempts/1/jobs') {
  reply([{ jobs: [{ name: 'checks', conclusion: 'success' }] }]);
} else if (args.at(-1) === 'repos/owner/repo/actions/runs/1/attempts/2/jobs') {
  reply([{ jobs: [] }]);
} else if (args.at(-1) === 'repos/owner/repo/actions/runs/2/attempts/1/jobs') {
  reply([{ jobs: [{ name: 'checks', conclusion: scenario === 'workflow-ci-failed' ? 'failure' : 'success' }] }]);
} else if (args.at(-1) === 'repos/owner/repo/issues/42/comments') {
  reply([[{ id: 1, user: { type: 'Bot' }, body: ${JSON.stringify(withState(undefined, { decision: { sha: head, needsOwner: false } }))} }]]);
} else if (args.at(-1) === 'repos/owner/repo/pulls/42/files') {
  reply([[{ filename: 'feature.ts' }]]);
} else if (args.at(-1) === 'repos/owner/repo/commits/' + head + '/check-runs') {
  record('commit checks');
  reply([{ check_runs: ['ci-never-ran', 'ready-with-active-ci'].includes(scenario) ? [] :
    [{ name: 'checks', status: 'completed', conclusion: 'success' }] }]);
} else if (args.includes('repos/owner/repo/issues/comments/1')) {
  writeFileSync(${JSON.stringify(comment)}, JSON.parse(readFileSync(0, 'utf8')).body);
  reply({});
} else if (args.includes('repos/owner/repo/statuses/' + head)) {
  const status = JSON.parse(readFileSync(0, 'utf8'));
  record(status.context + ': ' + status.state);
} else if (JSON.stringify(args) === JSON.stringify(['pr', 'merge', '42', '--repo', 'owner/repo', '--squash', '--match-head-commit', head]) && process.env.GH_TOKEN === 'fixture-merge-token') {
  if (scenario === 'forbidden') {
    record('forbidden');
    console.error('GraphQL: Resource not accessible by personal access token');
    process.exitCode = 1;
  } else if (blocked && !['always-blocked', 'label-with-active-ci', 'ci-starts-before-retry'].includes(scenario)) {
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
          ...(scenario.startsWith('workflow-') ? {} : { PR_NUMBER: '42' }),
          HEAD_OWNER: 'owner',
          HEAD_BRANCH: 'feature',
          ...([
            'ready-with-active-ci',
            'branch-renamed-after-ci',
            'ci-never-ran',
          ].includes(scenario)
            ? { TRIGGER_ACTION: 'ready_for_review' }
            : {}),
          ...([
            'label-with-active-ci',
            'ci-starts-before-first-merge',
            'ci-starts-before-retry',
            'ci-starts-during-retry',
            'fork-ci-active',
            'other-pr-ci-active',
            'deleted-fork',
          ].includes(scenario)
            ? { TRIGGER_ACTION: 'labeled', TRIGGER_LABEL: 'approved' }
            : {}),
          ...(scenario.startsWith('workflow-')
            ? { TRIGGER_ACTION: 'completed' }
            : {}),
          HEAD_SHA: head,
          GITHUB_SERVER_URL: 'https://github.com',
          GITHUB_RUN_ID: '123',
          MERGE_TOKEN: 'fixture-merge-token',
          MERGE_WAIT_MARKER: waitMarker,
        },
      },
    );
    if (result.error) throw result.error;
    return {
      status: result.status,
      events: JSON.parse(readFileSync(events, 'utf8')) as unknown,
      output: result.stdout,
      approvedHead: savedState(readFileSync(comment, 'utf8'))?.approvedHead,
    };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

describe('landing after a verdict', () => {
  const passingVerdict = ['Agent verdict: pending', 'Agent verdict: success'];

  it('leaves a label-triggered verdict pending while fresh CI runs on an already checked head', () => {
    const result = landing('label-with-active-ci');
    expect(result.status).toBe(0);
    expect(result.events).toEqual(['Agent verdict: pending']);
    expect(result.output).toContain('### #42: Waiting for CI');
    expect(result.approvedHead).toBe(head);
  });

  it('reports waiting when a ready event queues CI before the required check is created', () => {
    const result = landing('ready-with-active-ci');
    expect(result.status).toBe(0);
    expect(result.events).toEqual(['Agent verdict: pending']);
    expect(result.output).toContain('### #42: Waiting for CI');
  });

  it('defers when CI starts after the label-triggered merge attempt', () => {
    const result = landing('ci-starts-before-retry');
    expect(result.status).toBe(0);
    expect(result.events).toEqual([
      ...passingVerdict,
      'blocked',
      'Agent verdict: pending',
    ]);
    expect(result.output).toContain('### #42: Waiting for CI');
  });

  it('defers when CI starts before the first merge attempt', () => {
    const result = landing('ci-starts-before-first-merge');
    expect(result.status).toBe(0);
    expect(result.events).toEqual([
      ...passingVerdict,
      'Agent verdict: pending',
    ]);
    expect(result.output).toContain('### #42: Waiting for CI');
  });

  it('defers when CI starts during the retry delay', () => {
    const result = landing('ci-starts-during-retry');
    expect(result.status).toBe(0);
    expect(result.events).toEqual([
      ...passingVerdict,
      'blocked',
      'Agent verdict: pending',
    ]);
    expect(result.output).toContain('### #42: Waiting for CI');
  });

  it('does not defer a label-triggered merge for a different repository on the same commit', () => {
    const result = landing('fork-ci-active');
    expect(result.status).toBe(0);
    expect(result.events).toEqual([...passingVerdict, 'blocked', 'merged']);
    expect(result.output).toContain('### #42: merged');
  });

  it('ignores active CI tied to another PR on the same branch and commit', () => {
    const result = landing('other-pr-ci-active');
    expect(result.status).toBe(0);
    expect(result.events).toEqual([...passingVerdict, 'blocked', 'merged']);
    expect(result.output).toContain('### #42: merged');
  });

  it('reports a deleted fork without looking up CI or attempting a merge', () => {
    const result = landing('deleted-fork');
    expect(result.status).toBe(0);
    expect(result.events).toEqual(['Agent verdict: failure']);
    expect(result.output).toContain(
      '### #42: The head repository is unavailable',
    );
  });

  it('uses the passing commit check after the branch is renamed', () => {
    const result = landing('branch-renamed-after-ci');
    expect(result.status).toBe(0);
    expect(result.events).toEqual([
      'commit checks',
      ...passingVerdict,
      'commit checks',
      'blocked',
      'commit checks',
      'merged',
    ]);
    expect(result.output).toContain('### #42: merged');
  });

  it('skips landing without writing a verdict when CI never ran', () => {
    const result = landing('ci-never-ran');
    expect(result.status).toBe(0);
    expect(result.events).toEqual(['commit checks']);
    expect(result.output).toContain(
      '### #42: CI has not passed on its head yet',
    );
  });

  it('leaves the verdict pending when a completed-CI event overlaps fresh CI', () => {
    const result = landing('workflow-ci-overlap');
    expect(result.status).toBe(0);
    expect(result.events).toEqual(['Agent verdict: pending']);
    expect(result.output).toContain('### #42: Waiting for CI');
  });

  it.each([
    { scenario: 'workflow-ci-cancelled' as const, note: 'CI was cancelled' },
    { scenario: 'workflow-ci-failed' as const, note: 'CI failed' },
  ])(
    'replaces the pending verdict when $note despite an older green check',
    ({ scenario, note }) => {
      const result = landing(scenario);
      expect(result.status).toBe(0);
      expect(result.events).toEqual(['Agent verdict: failure']);
      expect(result.output).toContain(`### #42: ${note}`);
    },
  );

  it('uses the latest green check when an older cancellation arrives late', () => {
    const result = landing('workflow-old-cancel-latest-green');
    expect(result.status).toBe(0);
    expect(result.events).toEqual([...passingVerdict, 'blocked', 'merged']);
    expect(result.output).toContain('### #42: merged');
  });

  it('can land when the required job passed in a failed workflow', () => {
    const result = landing('workflow-failed-check-green');
    expect(result.status).toBe(0);
    expect(result.events).toEqual([...passingVerdict, 'blocked', 'merged']);
    expect(result.output).toContain('### #42: merged');
  });

  it('leaves the completed-CI trigger able to land the same head', () => {
    const result = landing('workflow-ci-completed');
    expect(result.status).toBe(0);
    expect(result.events).toEqual([...passingVerdict, 'blocked', 'merged']);
    expect(result.output).toContain('### #42: merged');
  });

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
