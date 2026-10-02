import { randomUUID } from 'node:crypto';
import {
  apiError,
  defineCase,
  defineFeature,
  invalidRequest,
  unknownOid,
  unknownWorktreeId,
} from '../scripts/feature.ts';
import {
  list,
  record,
  type Session,
} from '../../../../apps/server/spec/kit/session.ts';
import {
  expectation,
  fingerprintOf,
  gitPath,
  gitRoute,
  head,
  receiptPath,
  settledReceipt,
  worktreeNotFound,
  worktreePath,
} from '../scripts/fixture.ts';
import { read } from '../../../../apps/server/spec/kit/requests.ts';

const run = (
  session: Session,
  body: unknown,
  worktreeId = session.worktreeId,
) => ({
  method: 'POST' as const,
  path: gitPath(session, '/actions', { worktreeId }),
  body,
});
function fetchInput(session: Session) {
  return {
    action: 'fetch' as const,
    remoteName: 'origin',
    sourceRef: `refs/heads/${session.fixture.branch}`,
  };
}

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
  reaches: `POST ${gitRoute}/actions`,
  paired: true,
  intent: 'intended',
  behaviour:
    'The owner runs a Git action (commit, amend, stash, restore a stash, discard, fetch, pull or push) under a client-chosen request ID, stating what they expect of the worktree: head, branch and in-progress state, the file fingerprints for file actions, and the upstream commit they saw for fetch, pull and push. The action is accepted at once (202, running) and runs in the background; its receipt settles as succeeded, rejected, conflicted or interrupted. A worktree that is not registered is not found, and nothing is accepted. If the worktree or its upstream no longer matches the expectation the action is rejected without touching it, and a remote whose URL Porcelain cannot use is rejected. A fetch, pull or push that reaches a remote is not verified here: Git reaches a local-path remote through /bin/sh, which the sandbox does not mount. Repeating a request ID returns its receipt (with the status its state maps to) instead of running again; reusing it for a different action is a conflict.',
  cases: [
    defineCase({
      name: 'repeat the request ID',
      async setup(session) {
        const path = 'note.txt';
        await session.writeFile(path, 'A note\n');
        const requestId = randomUUID();
        const body = {
          requestId,
          input: { action: 'commit', message: 'Keep a note', paths: [path] },
          expected: {
            ...(await expectation(session)),
            files: [{ path, fingerprint: await fingerprintOf(session, path) }],
          },
        };
        await session.read(run(session, body), 202);
        await settledReceipt(session, requestId);
        return body;
      },
      request: (session, body) => [
        run(session, body),
        run(session, {
          ...body,
          input: { ...body.input, message: 'A different note' },
        }),
      ],
      expect({ responses, state, check, checkPartial }) {
        check('replay status', 200, responses[0]?.status);
        checkPartial(
          'replay returns the settled receipt',
          { requestId: state.requestId, state: 'succeeded' },
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
        check(
          'no changes remain',
          [],
          (
            await read(session, {
              method: 'GET',
              path: worktreePath(session, '/changes'),
            })
          ).changes,
        );
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
        check(
          'no changes remain',
          [],
          (
            await read(session, {
              method: 'GET',
              path: worktreePath(session, '/changes'),
            })
          ).changes,
        );
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
      name: 'a file that changed since it was looked at',
      async setup(session) {
        const path = session.fixture.readme.path;
        await session.writeFile(path, 'Looked at\n');
        const expected = await readmeExpected(session);
        await session.writeFile(path, 'Changed after looking\n');
        return action(session, { action: 'discard', path }, expected);
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
        checkPartial(
          'rejected',
          { state: 'rejected', reason: 'CHANGED_SINCE_LOOKED' },
          settled.receipt,
        );
        check(
          'the newer content is kept',
          'Changed after looking\n',
          await session.readFile(session.fixture.readme.path),
        );
        await session.git('checkout', '--', session.fixture.readme.path);
      },
    }),
    defineCase({
      name: 'the worktree no longer matches',
      async setup(session) {
        return {
          head: await head(session),
          body: await action(session, fetchInput(session), {
            headOid: unknownOid,
            upstreamOid: unknownOid,
          }),
        };
      },
      request: (session, state) => [run(session, state.body)],
      async expect({ responses, state, session, check, checkPartial }) {
        check('accepted', 202, responses[0]?.status);
        checkPartial(
          'running receipt',
          { requestId: state.body.requestId, state: 'running' },
          responses[0]?.body,
        );
        const settled = await settledReceipt(session, state.body.requestId);
        check('receipt read status', 200, settled.status);
        checkPartial(
          'rejected',
          { state: 'rejected', reason: 'CHANGED_SINCE_LOOKED' },
          settled.receipt,
        );
        check('head unchanged', state.head, await head(session));
        const replay = await session.send(run(session, state.body));
        check('replaying a rejected action answers 409', 409, replay.status);
        checkPartial(
          'with its receipt',
          { requestId: state.body.requestId, state: 'rejected' },
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
      setup: (session) => action(session, fetchInput(session)),
      request: (session, body) => run(session, body, unknownWorktreeId),
      async expect({ response, state, session, check }) {
        check('status', 404, response.status);
        check('error body', worktreeNotFound, response.body);
        const receipt = await session.send({
          method: 'GET',
          path: receiptPath(session, state.requestId),
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
          input: fetchInput(session),
          expected,
        }),
        run(session, {
          requestId: randomUUID(),
          input: { action: 'commit', message: '   ', paths: [] },
          expected,
        }),
        run(session, { requestId: randomUUID(), input: fetchInput(session) }),
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
          [session.fixture.branch],
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
