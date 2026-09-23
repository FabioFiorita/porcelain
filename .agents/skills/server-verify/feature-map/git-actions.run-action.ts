import { randomUUID } from 'node:crypto';
import { runGitActionResponseSchema } from '../../../../packages/contracts/src/git-actions/index.ts';
import {
  apiError,
  defineCase,
  defineFeature,
  invalidRequest,
  list,
  record,
  unknownOid,
  unknownWorktreeId,
  type Session,
} from '../scripts/feature.ts';
import {
  changes,
  expectation,
  sampleFingerprint,
  settledReceipt,
  worktreeNotFound,
} from '../scripts/fixture.ts';

const run = (
  session: Session,
  body: unknown,
  worktreeId = session.worktreeId,
) => ({
  method: 'POST' as const,
  path: `/api/projects/${session.projectId}/worktrees/${worktreeId}/git/actions`,
  body,
});
const branchRequest = {
  requestId: randomUUID(),
  input: { action: 'create-branch', branch: 'feature', switchTo: false },
};

export default defineFeature({
  feature: 'git-actions.run-action',
  reaches: 'POST /api/projects/:projectId/worktrees/:worktreeId/git/actions',
  intent: 'intended',
  behaviour:
    'The owner runs a Git action (fetch, pull, push, commit, amend, stash, discard, switch or create a branch) under a client-chosen request ID, stating what they expect of the worktree (head, branch, in-progress state and, for file actions, file fingerprints). The action is accepted at once (202, running) and runs in the background; its receipt settles as succeeded, no-change, rejected, conflicted or interrupted. A worktree that is not registered is not found, and nothing is accepted. If the worktree no longer matches the expectation the action is rejected without touching it. Repeating a request ID returns its receipt (with the status its state maps to) instead of running again; reusing it for a different action is a conflict.',
  cases: [
    defineCase({
      name: 'create a branch',
      async setup(session) {
        return { ...branchRequest, expected: await expectation(session) };
      },
      request: (session, body) => run(session, body),
      async expect({
        response,
        state,
        session,
        check,
        checkPartial,
        checkContract,
      }) {
        check('accepted', 202, response.status);
        checkContract('contract', runGitActionResponseSchema, response.body);
        checkPartial(
          'running receipt',
          {
            requestId: state.requestId,
            projectId: session.projectId,
            worktreeId: session.worktreeId,
            action: 'create-branch',
            state: 'running',
            progress: [],
          },
          response.body,
        );
        const settled = await settledReceipt(session, state.requestId);
        checkPartial(
          'settled receipt',
          {
            state: 'succeeded',
            result: { headOid: state.expected.headOid, branch: 'feature' },
          },
          settled.receipt,
        );
        check(
          'branch exists',
          'feature\n',
          await session.git(
            'branch',
            '--list',
            'feature',
            '--format=%(refname:short)',
          ),
        );
      },
    }),
    defineCase({
      name: 'repeat the request ID',
      async setup(session) {
        return { ...branchRequest, expected: await expectation(session) };
      },
      request: (session, body) => [
        run(session, body),
        run(session, { ...body, input: { ...body.input, branch: 'other' } }),
      ],
      expect({ responses, check, checkPartial }) {
        check('replay status', 200, responses[0]?.status);
        checkPartial(
          'replay returns the settled receipt',
          { requestId: branchRequest.requestId, state: 'succeeded' },
          responses[0]?.body,
        );
        check('different action status', 409, responses[1]?.status);
        check(
          'different action error body',
          apiError(
            409,
            'Conflict',
            'Git action request does not match its receipt',
          ),
          responses[1]?.body,
        );
      },
    }),
    defineCase({
      name: 'commit the sample change',
      async setup(session) {
        return {
          requestId: randomUUID(),
          input: {
            action: 'commit',
            message: 'Describe the change',
            paths: ['README.md'],
          },
          expected: {
            ...(await expectation(session)),
            files: [{ path: 'README.md', fingerprint: sampleFingerprint }],
          },
        };
      },
      request: (session, body) => run(session, body),
      async expect({ response, state, session, check }) {
        check('accepted', 202, response.status);
        const settled = await settledReceipt(session, state.requestId);
        check('succeeded', 'succeeded', settled.receipt.state);
        const head = (await session.git('rev-parse', 'HEAD')).trim();
        check(
          'receipt names the new head',
          head,
          record(settled.receipt.result).headOid,
        );
        check(
          'commit message',
          'Describe the change\n',
          await session.git('log', '-1', '--format=%B'),
        );
        check('no changes remain', [], (await changes(session)).changes);
      },
    }),
    defineCase({
      name: 'the worktree no longer matches',
      async setup(session) {
        return {
          requestId: randomUUID(),
          input: {
            action: 'create-branch',
            branch: 'too-late',
            switchTo: false,
          },
          expected: { ...(await expectation(session)), headOid: unknownOid },
        };
      },
      request: (session, body) => [run(session, body)],
      async expect({ responses, state, session, check, checkPartial }) {
        check('accepted', 202, responses[0]?.status);
        const settled = await settledReceipt(session, state.requestId);
        check('receipt read status', 200, settled.status);
        checkPartial(
          'rejected',
          { state: 'rejected', reason: 'CHANGED_SINCE_LOOKED' },
          settled.receipt,
        );
        check(
          'no branch was created',
          '',
          await session.git('branch', '--list', 'too-late'),
        );
        const replay = await session.send(run(session, state));
        check('replaying a rejected action answers 409', 409, replay.status);
        checkPartial(
          'with its receipt',
          { requestId: state.requestId, state: 'rejected' },
          replay.body,
        );
      },
    }),
    defineCase({
      name: 'a worktree that is not registered',
      async setup(session) {
        return {
          requestId: randomUUID(),
          input: {
            action: 'create-branch',
            branch: 'nowhere',
            switchTo: false,
          },
          expected: await expectation(session),
        };
      },
      request: (session, body) => run(session, body, unknownWorktreeId),
      async expect({ response, state, session, check }) {
        check('status', 404, response.status);
        check('error body', worktreeNotFound, response.body);
        const receipt = await session.send({
          method: 'GET',
          path: `/api/git-action-requests/${state.requestId}`,
        });
        check('no receipt was kept', 404, receipt.status);
      },
    }),
    defineCase({
      name: 'invalid input',
      async setup(session) {
        return expectation(session);
      },
      request: (session, expected) => [
        run(session, {
          requestId: randomUUID(),
          input: { action: 'stage', paths: ['README.md'] },
          expected,
        }),
        run(session, {
          requestId: 'not-a-uuid',
          input: branchRequest.input,
          expected,
        }),
        run(session, {
          requestId: randomUUID(),
          input: { action: 'commit', message: '   ', paths: [] },
          expected,
        }),
        run(session, { requestId: randomUUID(), input: branchRequest.input }),
      ],
      async expect({ responses, session, check }) {
        for (const [index, response] of responses.entries()) {
          check(`request ${index + 1} status`, 400, response.status);
          check(
            `request ${index + 1} error body`,
            invalidRequest,
            response.body,
          );
        }
        check(
          'branches unchanged',
          ['feature', 'main'],
          list(
            (await session.git('branch', '--format=%(refname:short)'))
              .trim()
              .split('\n'),
          ),
        );
      },
    }),
  ],
});
