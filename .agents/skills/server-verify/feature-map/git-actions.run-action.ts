import { randomUUID } from 'node:crypto';
import { runGitActionResponseSchema } from '@porcelain/contracts/git-actions';
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
  fingerprintOf,
  head,
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

async function action(
  session: Session,
  input: Record<string, unknown>,
  expected: Record<string, unknown> = {},
) {
  return {
    requestId: randomUUID(),
    input,
    expected: { ...(await expectation(session)), ...expected },
  };
}

async function readmeExpected(session: Session) {
  const path = session.fixture.readme.path;
  return { files: [{ path, fingerprint: await fingerprintOf(session, path) }] };
}

async function upstreamRemote(session: Session) {
  const remote = `${session.projectHome}/remote.git`;
  const branch = session.fixture.branch;
  await session.git('init', '--bare', '-b', branch, remote);
  await session.git('remote', 'add', 'origin', remote);
  await session.git('push', '--set-upstream', 'origin', branch);
  return (await session.git('rev-parse', `origin/${branch}`)).trim();
}

export default defineFeature({
  feature: 'git-actions.run-action',
  reaches: 'POST /api/projects/:projectId/worktrees/:worktreeId/git/actions',
  paired: true,
  intent: 'intended',
  behaviour:
    'The owner runs a Git action (commit, amend, stash, restore a stash, discard, switch or create a branch, fetch, pull or push) under a client-chosen request ID, stating what they expect of the worktree: head, branch and in-progress state, the file fingerprints for file actions, and the upstream commit they saw for fetch, pull and push. The action is accepted at once (202, running) and runs in the background; its receipt settles as succeeded, rejected, conflicted or interrupted. A worktree that is not registered is not found, and nothing is accepted. If the worktree or its upstream no longer matches the expectation the action is rejected without touching it, and a remote whose URL Porcelain cannot use is rejected. A fetch, pull or push that reaches a remote is not verified here: Git reaches a local-path remote through /bin/sh, which the sandbox does not mount. Repeating a request ID returns its receipt (with the status its state maps to) instead of running again; reusing it for a different action is a conflict.',
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
        return action(
          session,
          {
            action: 'commit',
            message: 'Describe the change',
            paths: [session.fixture.readme.path],
          },
          await readmeExpected(session),
        );
      },
      request: (session, body) => run(session, body),
      async expect({ response, state, session, check, checkPartial }) {
        check('accepted', 202, response.status);
        checkPartial(
          'running receipt',
          { requestId: state.requestId, action: 'commit', state: 'running' },
          response.body,
        );
        const settled = await settledReceipt(session, state.requestId);
        check('succeeded', 'succeeded', settled.receipt.state);
        check(
          'receipt names the new head',
          await head(session),
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
      name: 'amend the last commit',
      async setup(session) {
        return {
          parent: (await session.git('rev-parse', 'HEAD~1')).trim(),
          body: await action(
            session,
            { action: 'amend', message: 'Describe the change well', paths: [] },
            { files: [] },
          ),
        };
      },
      request: (session, state) => run(session, state.body),
      async expect({ response, state, session, check, checkPartial }) {
        check('accepted', 202, response.status);
        checkPartial(
          'running receipt',
          {
            requestId: state.body.requestId,
            action: 'amend',
            state: 'running',
          },
          response.body,
        );
        const settled = await settledReceipt(session, state.body.requestId);
        const amended = await head(session);
        checkPartial(
          'settled receipt',
          { state: 'succeeded', result: { headOid: amended } },
          settled.receipt,
        );
        check(
          'the head is replaced, not added to',
          state.parent,
          (await session.git('rev-parse', 'HEAD~1')).trim(),
        );
        check(
          'commit message',
          'Describe the change well\n',
          await session.git('log', '-1', '--format=%B'),
        );
      },
    }),
    defineCase({
      name: 'stash a change',
      async setup(session) {
        await session.writeFile(session.fixture.readme.path, 'Parked\n');
        return action(
          session,
          {
            action: 'stash-create',
            message: 'Parked',
            includeUntracked: false,
          },
          await readmeExpected(session),
        );
      },
      request: (session, body) => run(session, body),
      async expect({ response, state, session, check, checkPartial }) {
        check('accepted', 202, response.status);
        checkPartial(
          'running receipt',
          {
            requestId: state.requestId,
            action: 'stash-create',
            state: 'running',
          },
          response.body,
        );
        const settled = await settledReceipt(session, state.requestId);
        checkPartial(
          'settled receipt',
          {
            state: 'succeeded',
            result: {
              stashOid: (await session.git('rev-parse', 'stash@{0}')).trim(),
              stashRetained: true,
            },
          },
          settled.receipt,
        );
        check('no changes remain', [], (await changes(session)).changes);
      },
    }),
    defineCase({
      name: 'restore a stash that no longer applies cleanly',
      async setup(session) {
        const path = session.fixture.readme.path;
        await session.writeFile(path, 'Committed meanwhile\n');
        await session.git('commit', '-am', 'Meanwhile');
        const stashOid = (await session.git('rev-parse', 'stash@{0}')).trim();
        return action(
          session,
          { action: 'stash-pop', stashOid, restoreIndex: false },
          { files: [] },
        );
      },
      request: (session, body) => run(session, body),
      async expect({ response, state, session, check, checkPartial }) {
        check('accepted', 202, response.status);
        checkPartial(
          'running receipt',
          { requestId: state.requestId, action: 'stash-pop', state: 'running' },
          response.body,
        );
        const settled = await settledReceipt(session, state.requestId);
        checkPartial(
          'settled receipt',
          {
            state: 'conflicted',
            result: { stashOid: state.input.stashOid, stashRetained: true },
          },
          settled.receipt,
        );
        check(
          'the stash is kept',
          state.input.stashOid,
          (await session.git('rev-parse', 'stash@{0}')).trim(),
        );
        await session.git('reset', '--hard', 'HEAD');
        await session.git('stash', 'drop');
      },
    }),
    defineCase({
      name: 'discard a change',
      async setup(session) {
        await session.writeFile(session.fixture.readme.path, 'To discard\n');
        return action(
          session,
          { action: 'discard', path: session.fixture.readme.path },
          await readmeExpected(session),
        );
      },
      request: (session, body) => run(session, body),
      async expect({ response, state, session, check, checkPartial }) {
        check('accepted', 202, response.status);
        checkPartial(
          'running receipt',
          { requestId: state.requestId, action: 'discard', state: 'running' },
          response.body,
        );
        const settled = await settledReceipt(session, state.requestId);
        check('succeeded', 'succeeded', settled.receipt.state);
        check(
          'the file is back as committed',
          await session.git('show', `HEAD:${session.fixture.readme.path}`),
          await session.readFile(session.fixture.readme.path),
        );
      },
    }),
    defineCase({
      name: 'switch to another branch',
      setup: (session) =>
        action(session, { action: 'switch-branch', branch: 'feature' }),
      request: (session, body) => run(session, body),
      async expect({ response, state, session, check, checkPartial }) {
        check('accepted', 202, response.status);
        checkPartial(
          'running receipt',
          {
            requestId: state.requestId,
            action: 'switch-branch',
            state: 'running',
          },
          response.body,
        );
        const settled = await settledReceipt(session, state.requestId);
        checkPartial(
          'settled receipt',
          { state: 'succeeded', result: { branch: 'feature' } },
          settled.receipt,
        );
        check(
          'the worktree is on the branch',
          'feature\n',
          await session.git('branch', '--show-current'),
        );
        await session.git('switch', session.fixture.branch);
      },
    }),
    defineCase({
      name: 'the worktree no longer matches',
      setup: (session) =>
        action(
          session,
          { action: 'create-branch', branch: 'too-late', switchTo: false },
          { headOid: unknownOid },
        ),
      request: (session, body) => [run(session, body)],
      async expect({ responses, state, session, check, checkPartial }) {
        check('accepted', 202, responses[0]?.status);
        checkPartial(
          'running receipt',
          { requestId: state.requestId, state: 'running' },
          responses[0]?.body,
        );
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
      name: 'fetch, pull and push after the upstream moved',
      async setup(session) {
        const upstream = await upstreamRemote(session);
        const source = `refs/heads/${session.fixture.branch}`;
        const stale = { upstreamOid: unknownOid };
        const remote = { remoteName: 'origin' };
        return {
          upstream,
          bodies: [
            await action(
              session,
              { action: 'fetch', ...remote, sourceRef: source },
              stale,
            ),
            await action(
              session,
              { action: 'pull', ...remote, sourceRef: source },
              stale,
            ),
            await action(
              session,
              {
                action: 'push',
                ...remote,
                destinationRef: source,
                allowCreate: false,
              },
              stale,
            ),
          ],
        };
      },
      request: (session, state) =>
        state.bodies.map((body) => run(session, body)),
      async expect({ responses, state, session, check, checkPartial }) {
        for (const [index, body] of state.bodies.entries()) {
          const name = String(body.input.action);
          check(`${name} accepted`, 202, responses[index]?.status);
          checkPartial(
            `${name} running receipt`,
            { requestId: body.requestId, state: 'running' },
            responses[index]?.body,
          );
          checkPartial(
            `${name} is rejected`,
            { state: 'rejected', reason: 'CHANGED_SINCE_LOOKED' },
            (await settledReceipt(session, body.requestId)).receipt,
          );
        }
        check(
          'the tracking branch did not move',
          state.upstream,
          (
            await session.git('rev-parse', `origin/${session.fixture.branch}`)
          ).trim(),
        );
      },
    }),
    defineCase({
      name: 'a remote whose URL Porcelain cannot use',
      async setup(session) {
        await session.git(
          'remote',
          'add',
          'daemon',
          'git://127.0.0.1:9/remote.git',
        );
        return action(
          session,
          {
            action: 'push',
            remoteName: 'daemon',
            destinationRef: `refs/heads/${session.fixture.branch}`,
            allowCreate: true,
          },
          { upstreamOid: null },
        );
      },
      request: (session, body) => run(session, body),
      async expect({ response, state, session, check, checkPartial }) {
        check('accepted', 202, response.status);
        checkPartial(
          'running receipt',
          { requestId: state.requestId, action: 'push', state: 'running' },
          response.body,
        );
        checkPartial(
          'rejected as unsupported',
          {
            state: 'rejected',
            reason: 'UNSUPPORTED_CONFIGURATION',
            message:
              'The remote URL is not one Porcelain can use. It supports a local path, SSH, and HTTPS without a user name, password or query in the URL. Change it with `git remote set-url`, or run this action from a terminal.',
          },
          (await settledReceipt(session, state.requestId)).receipt,
        );
      },
    }),
    defineCase({
      name: 'a worktree that is not registered',
      setup: (session) =>
        action(session, {
          action: 'create-branch',
          branch: 'nowhere',
          switchTo: false,
        }),
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
      setup: expectation,
      request: (session, expected) => [
        run(session, {
          requestId: randomUUID(),
          input: { action: 'stage', paths: [session.fixture.readme.path] },
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
        run(session, {
          requestId: randomUUID(),
          input: {
            action: 'fetch',
            remoteName: 'origin',
            sourceRef: `refs/heads/${session.fixture.branch}`,
          },
          expected,
        }),
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
          ['feature', session.fixture.branch].sort(),
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
