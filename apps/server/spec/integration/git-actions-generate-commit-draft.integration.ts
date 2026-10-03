import { generateCommitDraftResponseSchema } from '@porcelain/contracts/git-actions';
import { expect } from 'vitest';
import {
  apiError,
  invalidRequest,
  unknownFingerprint,
  unknownWorktreeId,
  worktreeNotFound,
} from '../kit/answers.ts';
import { changes, head, type Changes } from '../kit/reads.ts';
import { gitPath } from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';
import { type HttpRequest, type Session } from '../kit/session.ts';

function draft(session: Session, body: unknown): HttpRequest {
  return { method: 'POST', path: gitPath(session, '/commit-draft'), body };
}

function unprocessable(message: string) {
  return apiError(422, 'Unprocessable Entity', message);
}

function groupedPaths(session: Session) {
  return session.fixture.codingTool.groups.flatMap((group) => group.paths);
}

function expectedFiles(state: Changes, paths: readonly string[]) {
  return state.changes.filter((change) => paths.includes(change.path));
}

async function withCodingTool(session: Session) {
  await session.installCodingTool();
  for (const path of groupedPaths(session))
    if (path !== session.fixture.readme.path)
      await session.writeFile(path, `Notes on ${path}\n`);
  return { ...(await changes(session)), head: await head(session) };
}

test('drafting a commit with a coding tool that is not installed is refused', async ({
  session,
}) => {
  const state = await changes(session);

  const response = await session.send(
    draft(session, {
      mode: 'message',
      model: 'claude:sonnet',
      expectedStatusToken: state.statusToken,
      paths: ['README.md'],
    }),
  );

  expect(response.status).toBe(422);
  expect(response.body).toStrictEqual(
    unprocessable('The selected coding CLI is not installed.'),
  );
});

test('drafting a commit with an unsupported model form is refused', async ({
  session,
}) => {
  const state = await changes(session);

  const responses = [
    await session.send(
      draft(session, {
        mode: 'message',
        model: 'other:model',
        expectedStatusToken: state.statusToken,
        paths: ['README.md'],
      }),
    ),
    await session.send(
      draft(session, {
        mode: 'groups',
        model: 'claude:default',
        expectedStatusToken: state.statusToken,
        paths: ['README.md'],
      }),
    ),
  ];

  expect(responses.map((response) => response.status)).toStrictEqual([
    422, 422,
  ]);
  expect(responses.map((response) => response.body)).toStrictEqual([
    unprocessable('Unsupported commit model.'),
    unprocessable('Unsupported commit model.'),
  ]);
});

test('drafting a commit against a stale status is a conflict and for a path that is not a change is refused', async ({
  session,
}) => {
  const state = await changes(session);

  const stale = await session.send(
    draft(session, {
      mode: 'message',
      model: 'claude:sonnet',
      expectedStatusToken: unknownFingerprint,
      paths: ['README.md'],
    }),
  );
  const notAChange = await session.send(
    draft(session, {
      mode: 'message',
      model: 'claude:sonnet',
      expectedStatusToken: state.statusToken,
      paths: ['missing.md'],
    }),
  );

  expect(stale.status).toBe(409);
  expect(stale.body).toStrictEqual(
    apiError(
      409,
      'Conflict',
      'Refresh status and retry inspection',
      'worktree_changed',
    ),
  );
  expect(notAChange.status).toBe(422);
  expect(notAChange.body).toStrictEqual(
    unprocessable('Select readable changed files to generate a commit draft.'),
  );
});

test('drafting a commit with invalid input is refused and for an unknown worktree is not found', async ({
  session,
}) => {
  const invalid = [
    await session.send(
      draft(session, {
        mode: 'poem',
        model: 'claude:sonnet',
        expectedStatusToken: unknownFingerprint,
        paths: ['README.md'],
      }),
    ),
    await session.send(
      draft(session, {
        mode: 'message',
        model: 'claude:sonnet',
        expectedStatusToken: unknownFingerprint,
        paths: [],
      }),
    ),
  ];
  const unknown = await session.send({
    method: 'POST',
    path: gitPath(session, '/commit-draft', {
      worktreeId: unknownWorktreeId,
    }),
    body: {
      mode: 'message',
      model: 'claude:sonnet',
      expectedStatusToken: unknownFingerprint,
      paths: ['README.md'],
    },
  });

  expect(invalid.map((response) => response.status)).toStrictEqual([400, 400]);
  expect(invalid.map((response) => response.body)).toStrictEqual([
    invalidRequest,
    invalidRequest,
  ]);
  expect(unknown.status).toBe(404);
  expect(unknown.body).toStrictEqual(worktreeNotFound);
});

test('drafting a message for the selected change answers the drafted message with the fingerprints it drafted from and commits nothing', async ({
  session,
}) => {
  const state = await withCodingTool(session);

  const response = await session.send(
    draft(session, {
      mode: 'message',
      model: 'claude:sonnet',
      expectedStatusToken: state.statusToken,
      paths: [session.fixture.readme.path],
    }),
  );

  expect(response.status).toBe(200);
  expect(response.body).toStrictEqual({
    groups: [session.fixture.codingTool.message],
    expectedFiles: expectedFiles(state, [session.fixture.readme.path]),
  });
  expect(response.body).toEqual(
    expect.schemaMatching(generateCommitDraftResponseSchema),
  );
  expect(await head(session)).toBe(state.head);
});

test('drafting a grouping for the selected changes answers the drafted groups with the fingerprints they were drafted from', async ({
  session,
}) => {
  const state = await withCodingTool(session);

  const response = await session.send(
    draft(session, {
      mode: 'groups',
      model: 'claude:haiku',
      expectedStatusToken: state.statusToken,
      paths: groupedPaths(session),
    }),
  );

  expect(response.status).toBe(200);
  expect(response.body).toStrictEqual({
    groups: session.fixture.codingTool.groups,
    expectedFiles: expectedFiles(state, groupedPaths(session)),
  });
  expect(response.body).toEqual(
    expect.schemaMatching(generateCommitDraftResponseSchema),
  );
});

test('a draft that leaves a selected path out, or a model the tool does not serve, is refused', async ({
  session,
}) => {
  const state = await withCodingTool(session);

  const uncovered = await session.send(
    draft(session, {
      mode: 'message',
      model: 'claude:sonnet',
      expectedStatusToken: state.statusToken,
      paths: groupedPaths(session),
    }),
  );
  const failing = await session.send(
    draft(session, {
      mode: 'message',
      model: 'claude:retired',
      expectedStatusToken: state.statusToken,
      paths: [session.fixture.readme.path],
    }),
  );

  expect(uncovered.status).toBe(422);
  expect(uncovered.body).toStrictEqual(
    unprocessable(
      'The generated groups did not cover the selected files. Generate again or write the message manually.',
    ),
  );
  expect(failing.status).toBe(422);
  expect(failing.body).toStrictEqual(
    unprocessable(
      'Commit generation failed. Check that the selected CLI is up to date and signed in.',
    ),
  );
});
