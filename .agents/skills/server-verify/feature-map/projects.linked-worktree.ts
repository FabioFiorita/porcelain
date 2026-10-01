import { randomUUID } from 'node:crypto';
import { readChangesResponseSchema } from '@porcelain/contracts/changes';
import { readInventoryResponseSchema } from '@porcelain/contracts/projects';
import {
  defineCase,
  defineFeature,
  list,
  record,
  type HttpRequest,
  type Session,
} from '../scripts/feature.ts';
import { eventually, gitRoute, read } from '../scripts/fixture.ts';

const branch = 'linked';
const inventory: HttpRequest = { method: 'GET', path: '/api/inventory' };
const linkedPath = (session: Session) => `${session.projectHome}/${branch}`;
const worktreesOf = (body: Record<string, unknown>) =>
  list(record(list(body.projects)[0]).worktrees).map((entry) => record(entry));
const at = (worktreeId: string, suffix: string) =>
  `/api/worktrees/${worktreeId}${suffix}`;

async function linkedId(session: Session) {
  const linked = worktreesOf(await read(session, inventory)).find(
    (worktree) => worktree.path === linkedPath(session),
  );
  if (typeof linked?.id !== 'string')
    throw new Error('The linked worktree is not listed');
  return linked.id;
}

async function settled(session: Session, worktreeId: string, id: string) {
  return eventually(
    session,
    { method: 'GET', path: at(worktreeId, `/git/receipts/${id}`) },
    (receipt) => receipt.state !== 'running',
  );
}

export default defineFeature({
  feature: 'projects.linked-worktree',
  reaches: [
    'GET /api/inventory',
    'GET /api/worktrees/:worktreeId/text',
    'GET /api/worktrees/:worktreeId/changes',
    `POST ${gitRoute}/actions`,
  ],
  paired: true,
  intent: 'intended',
  behaviour:
    'A worktree added to a registered repository with git worktree add is listed beside the main checkout on its own branch, available, and is read and acted on like the main one: its files and changes are its own checkout, and a Git action on it commits to its branch and leaves the main checkout alone.',
  cases: [
    defineCase({
      name: 'a linked worktree is listed beside the main one',
      async setup(session) {
        await session.git('worktree', 'add', '-b', branch, linkedPath(session));
        await eventually(
          session,
          inventory,
          (body) => worktreesOf(body).length === 2,
        );
        return undefined;
      },
      request: () => inventory,
      expect({ response, session, check, checkContract, checkPartial }) {
        check('status', 200, response.status);
        checkContract('contract', readInventoryResponseSchema, response.body);
        const worktrees = worktreesOf(record(response.body));
        check('two worktrees', 2, worktrees.length);
        checkPartial(
          'main checkout',
          {
            id: session.worktreeId,
            path: session.repository,
            main: true,
            branch: `refs/heads/${session.fixture.branch}`,
            available: true,
          },
          worktrees.find((worktree) => worktree.main === true),
        );
        checkPartial(
          'linked worktree',
          {
            path: linkedPath(session),
            main: false,
            branch: `refs/heads/${branch}`,
            available: true,
            status: null,
          },
          worktrees.find((worktree) => worktree.main === false),
        );
      },
    }),
    defineCase({
      name: 'the linked worktree reads its own checkout',
      setup: linkedId,
      request: (session, worktreeId) => [
        {
          method: 'GET',
          path: at(worktreeId, '/text'),
          query: { path: session.fixture.readme.path },
        },
        { method: 'GET', path: at(worktreeId, '/changes') },
      ],
      expect({
        responses,
        state,
        session,
        check,
        checkContract,
        checkPartial,
      }) {
        const [text, changes] = responses;
        check(
          'statuses',
          [200, 200],
          responses.map((entry) => entry.status),
        );
        checkPartial(
          'committed README, not the main checkout edit',
          {
            worktreeId: state,
            path: session.fixture.readme.path,
            text: session.fixture.readme.committed,
          },
          text?.body,
        );
        checkContract(
          'changes contract',
          readChangesResponseSchema,
          changes?.body,
        );
        check('no changes', [], record(changes?.body).changes);
      },
    }),
    defineCase({
      name: 'a commit in the linked worktree goes to its branch',
      async setup(session) {
        const worktreeId = await linkedId(session);
        const note = 'linked-note.md';
        await session.writeFile(note, 'A note in the linked worktree\n');
        await session.rename(
          `${session.repository}/${note}`,
          `${linkedPath(session)}/${note}`,
        );
        const status = await eventually(
          session,
          { method: 'GET', path: at(worktreeId, '/changes') },
          (body) => list(body.changes).length === 1,
        );
        const change = record(list(status.changes)[0]);
        return {
          worktreeId,
          body: {
            requestId: randomUUID(),
            input: {
              action: 'commit',
              message: 'Keep a note in the linked worktree',
              paths: [note],
            },
            expected: {
              headOid: status.headOid,
              branch,
              inProgress: null,
              mergeHeadOid: null,
              files: [{ path: note, fingerprint: change.fingerprint }],
            },
          },
        };
      },
      request: (_session, state) => ({
        method: 'POST',
        path: at(state.worktreeId, '/git/actions'),
        body: state.body,
      }),
      async expect({ response, state, session, check, checkPartial }) {
        check('accepted', 202, response.status);
        checkPartial(
          'running receipt',
          {
            requestId: state.body.requestId,
            action: 'commit',
            state: 'running',
          },
          response.body,
        );
        checkPartial(
          'settled receipt',
          { requestId: state.body.requestId, state: 'succeeded' },
          await settled(session, state.worktreeId, state.body.requestId),
        );
        check(
          'linked branch tip',
          'Keep a note in the linked worktree',
          (await session.git('log', '-1', '--format=%s', branch)).trim(),
        );
        check(
          'main checkout tip unchanged',
          session.fixture.initialCommit,
          (await session.git('log', '-1', '--format=%s')).trim(),
        );
      },
    }),
  ],
});
