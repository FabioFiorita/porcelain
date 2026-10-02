import { randomUUID } from 'node:crypto';
import { expect } from 'vitest';
import {
  apiError,
  invalidRequest,
  unknownOid,
  unknownWorktreeId,
  worktreeNotFound,
} from '../kit/answers.ts';
import {
  expectation,
  fingerprintOf,
  head,
  settledReceipt,
} from '../kit/reads.ts';
import { gitPath, read, receiptPath, worktreePath } from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';
import {
  list,
  record,
  type HttpRequest,
  type Session,
} from '../kit/session.ts';

function run(
  session: Session,
  body: unknown,
  worktreeId = session.worktreeId,
): HttpRequest {
  return {
    method: 'POST',
    path: gitPath(session, '/actions', { worktreeId }),
    body,
  };
}

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

test('repeating a request id returns its settled receipt, and reusing it for a different action is a conflict', async ({
  session,
}) => {
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

  const replay = await session.send(run(session, body));
  const different = await session.send(
    run(session, {
      ...body,
      input: { ...body.input, message: 'A different note' },
    }),
  );

  expect(replay.status).toBe(200);
  expect(replay.body).toMatchObject({ requestId, state: 'succeeded' });
  expect(different.status).toBe(409);
  expect(different.body).toStrictEqual(
    apiError(409, 'Conflict', 'Git action request does not match its receipt'),
  );
});

test('committing the sample change is accepted running and settles with the new head and no changes left', async ({
  session,
}) => {
  const body = await action(
    session,
    {
      action: 'commit',
      message: 'Describe the change',
      paths: [session.fixture.readme.path],
    },
    await readmeExpected(session),
  );

  const response = await session.send(run(session, body));

  expect(response.status).toBe(202);
  expect(response.body).toMatchObject({
    requestId: body.requestId,
    action: 'commit',
    state: 'running',
  });
  const settled = await settledReceipt(session, body.requestId);
  expect(settled.receipt.state).toBe('succeeded');
  expect(record(settled.receipt.result).headOid).toBe(await head(session));
  expect(await session.git('log', '-1', '--format=%B')).toBe(
    'Describe the change\n',
  );
  expect(
    (
      await read(session, {
        method: 'GET',
        path: worktreePath(session, '/changes'),
      })
    ).changes,
  ).toStrictEqual([]);
});

test('amending the last commit replaces the head with the new message instead of adding to it', async ({
  session,
}) => {
  const parent = (await session.git('rev-parse', 'HEAD~1')).trim();
  const body = await action(
    session,
    { action: 'amend', message: 'Describe the change well', paths: [] },
    { files: [] },
  );

  const response = await session.send(run(session, body));

  expect(response.status).toBe(202);
  expect(response.body).toMatchObject({
    requestId: body.requestId,
    action: 'amend',
    state: 'running',
  });
  const settled = await settledReceipt(session, body.requestId);
  const amended = await head(session);
  expect(settled.receipt).toMatchObject({
    state: 'succeeded',
    result: { headOid: amended },
  });
  expect((await session.git('rev-parse', 'HEAD~1')).trim()).toBe(parent);
  expect(await session.git('log', '-1', '--format=%B')).toBe(
    'Describe the change well\n',
  );
});

test('stashing a change settles with the retained stash and no changes left', async ({
  session,
}) => {
  await session.writeFile(session.fixture.readme.path, 'Parked\n');
  const body = await action(
    session,
    {
      action: 'stash-create',
      message: 'Parked',
      includeUntracked: false,
    },
    await readmeExpected(session),
  );

  const response = await session.send(run(session, body));

  expect(response.status).toBe(202);
  expect(response.body).toMatchObject({
    requestId: body.requestId,
    action: 'stash-create',
    state: 'running',
  });
  const settled = await settledReceipt(session, body.requestId);
  expect(settled.receipt).toMatchObject({
    state: 'succeeded',
    result: {
      stashOid: (await session.git('rev-parse', 'stash@{0}')).trim(),
      stashRetained: true,
    },
  });
  expect(
    (
      await read(session, {
        method: 'GET',
        path: worktreePath(session, '/changes'),
      })
    ).changes,
  ).toStrictEqual([]);
});

test('restoring a stash that no longer applies cleanly settles conflicted and keeps the stash', async ({
  session,
}) => {
  const path = session.fixture.readme.path;
  await session.writeFile(path, 'Committed meanwhile\n');
  await session.git('commit', '-am', 'Meanwhile');
  const stashOid = (await session.git('rev-parse', 'stash@{0}')).trim();
  const body = await action(
    session,
    { action: 'stash-pop', stashOid, restoreIndex: false },
    { files: [] },
  );

  const response = await session.send(run(session, body));

  expect(response.status).toBe(202);
  expect(response.body).toMatchObject({
    requestId: body.requestId,
    action: 'stash-pop',
    state: 'running',
  });
  const settled = await settledReceipt(session, body.requestId);
  expect(settled.receipt).toMatchObject({
    state: 'conflicted',
    result: { stashOid, stashRetained: true },
  });
  expect((await session.git('rev-parse', 'stash@{0}')).trim()).toBe(stashOid);
  await session.git('reset', '--hard', 'HEAD');
  await session.git('stash', 'drop');
});

test('discarding a change puts the file back as committed', async ({
  session,
}) => {
  await session.writeFile(session.fixture.readme.path, 'To discard\n');
  const body = await action(
    session,
    { action: 'discard', path: session.fixture.readme.path },
    await readmeExpected(session),
  );

  const response = await session.send(run(session, body));

  expect(response.status).toBe(202);
  expect(response.body).toMatchObject({
    requestId: body.requestId,
    action: 'discard',
    state: 'running',
  });
  const settled = await settledReceipt(session, body.requestId);
  expect(settled.receipt.state).toBe('succeeded');
  expect(await session.readFile(session.fixture.readme.path)).toBe(
    await session.git('show', `HEAD:${session.fixture.readme.path}`),
  );
});

test('discarding a file that changed since it was looked at is rejected and keeps the newer content', async ({
  session,
}) => {
  const path = session.fixture.readme.path;
  await session.writeFile(path, 'Looked at\n');
  const expected = await readmeExpected(session);
  await session.writeFile(path, 'Changed after looking\n');
  const body = await action(session, { action: 'discard', path }, expected);

  const response = await session.send(run(session, body));

  expect(response.status).toBe(202);
  expect(response.body).toMatchObject({
    requestId: body.requestId,
    action: 'discard',
    state: 'running',
  });
  const settled = await settledReceipt(session, body.requestId);
  expect(settled.receipt).toMatchObject({
    state: 'rejected',
    reason: 'CHANGED_SINCE_LOOKED',
  });
  expect(await session.readFile(session.fixture.readme.path)).toBe(
    'Changed after looking\n',
  );
  await session.git('checkout', '--', session.fixture.readme.path);
});

test('an action against a worktree that no longer matches is rejected without touching it, and replaying it is a conflict with its receipt', async ({
  session,
}) => {
  const before = await head(session);
  const body = await action(session, fetchInput(session), {
    headOid: unknownOid,
    upstreamOid: unknownOid,
  });

  const response = await session.send(run(session, body));

  expect(response.status).toBe(202);
  expect(response.body).toMatchObject({
    requestId: body.requestId,
    state: 'running',
  });
  const settled = await settledReceipt(session, body.requestId);
  expect(settled.status).toBe(200);
  expect(settled.receipt).toMatchObject({
    state: 'rejected',
    reason: 'CHANGED_SINCE_LOOKED',
  });
  expect(await head(session)).toBe(before);
  const replay = await session.send(run(session, body));
  expect(replay.status).toBe(409);
  expect(replay.body).toMatchObject({
    requestId: body.requestId,
    state: 'rejected',
  });
});

test('fetch, pull and push after the upstream moved are rejected and the tracking branch does not move', async ({
  session,
}) => {
  const upstream = await upstreamRemote(session);
  const source = `refs/heads/${session.fixture.branch}`;
  const stale = { upstreamOid: unknownOid };
  const remote = { remoteName: 'origin' };
  const bodies = [
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
  ];

  const responses = [];
  for (const body of bodies)
    responses.push(await session.send(run(session, body)));

  expect(responses.map((response) => response.status)).toStrictEqual([
    202, 202, 202,
  ]);
  for (const [index, body] of bodies.entries()) {
    expect(responses[index]?.body).toMatchObject({
      requestId: body.requestId,
      state: 'running',
    });
    expect(
      (await settledReceipt(session, body.requestId)).receipt,
    ).toMatchObject({ state: 'rejected', reason: 'CHANGED_SINCE_LOOKED' });
  }
  expect(
    (await session.git('rev-parse', `origin/${session.fixture.branch}`)).trim(),
  ).toBe(upstream);
});

test('pushing to a remote whose URL Porcelain cannot use is rejected as unsupported', async ({
  session,
}) => {
  await session.git('remote', 'add', 'daemon', 'git://127.0.0.1:9/remote.git');
  const body = await action(
    session,
    {
      action: 'push',
      remoteName: 'daemon',
      destinationRef: `refs/heads/${session.fixture.branch}`,
      allowCreate: true,
    },
    { upstreamOid: null },
  );

  const response = await session.send(run(session, body));

  expect(response.status).toBe(202);
  expect(response.body).toMatchObject({
    requestId: body.requestId,
    action: 'push',
    state: 'running',
  });
  expect((await settledReceipt(session, body.requestId)).receipt).toMatchObject(
    {
      state: 'rejected',
      reason: 'UNSUPPORTED_CONFIGURATION',
      message:
        'The remote URL is not one Porcelain can use. It supports a local path, SSH, and HTTPS without a user name, password or query in the URL. Change it with `git remote set-url`, or run this action from a terminal.',
    },
  );
});

test('running an action in a worktree that is not registered is not found and keeps no receipt', async ({
  session,
}) => {
  const body = await action(session, fetchInput(session));

  const response = await session.send(run(session, body, unknownWorktreeId));

  expect(response.status).toBe(404);
  expect(response.body).toStrictEqual(worktreeNotFound);
  const receipt = await session.send({
    method: 'GET',
    path: receiptPath(session, body.requestId),
  });
  expect(receipt.status).toBe(404);
});

test('running an action with invalid input is refused and changes no branch', async ({
  session,
}) => {
  const expected = await expectation(session);
  const requests = [
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
  ];

  const responses = [];
  for (const request of requests) responses.push(await session.send(request));

  expect(responses.map((response) => response.status)).toStrictEqual([
    400, 400, 400, 400, 400,
  ]);
  expect(responses.map((response) => response.body)).toStrictEqual([
    invalidRequest,
    invalidRequest,
    invalidRequest,
    invalidRequest,
    invalidRequest,
  ]);
  expect(
    list(
      (await session.git('branch', '--format=%(refname:short)'))
        .trim()
        .split('\n'),
    ),
  ).toStrictEqual([session.fixture.branch]);
});
