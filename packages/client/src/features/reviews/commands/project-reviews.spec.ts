import { expect, it } from 'vitest';
import {
  clientFixtures,
  readClientAtom,
} from '../../../../spec/kit/client-fixture.ts';
import { reviewCommands } from './project-reviews.ts';

const create = clientFixtures();
const reviewId = 'f23e9c08-8fb8-4e50-893b-f0a25c64192b';
const layerId = 'a23e9c08-8fb8-4e50-893b-f0a25c64192b';
const fingerprint = 'a'.repeat(64);
it.each([false, true])(
  'records the decision only after its files succeed; file failure is %s',
  async (fail) => {
    const sent: unknown[] = [];
    const subject = create((path, init) => {
      expect(path).toBe(`/api/reviews/${reviewId}/marks`);
      const body = init?.body;
      sent.push(
        body instanceof Uint8Array
          ? JSON.parse(new TextDecoder().decode(body))
          : null,
      );
      return Promise.resolve(
        Response.json(
          fail ? { message: 'The selected blob changed' } : { updated: true },
          { status: fail ? 409 : 200 },
        ),
      );
    });
    const command = reviewCommands({
      connection: subject.connection,
      reviewId,
    }).completeDecision;
    subject.registry.set(command, {
      revision: 2,
      layerId,
      fingerprint,
      files: [{ path: 'owner.ts', headBlobOid: 'b'.repeat(40) }],
    });
    const answer = readClientAtom(subject.registry, command);
    if (fail) await expect(answer).rejects.toThrow();
    else expect(await answer).toEqual({ updated: true });
    expect(sent).toEqual([
      {
        kind: 'file',
        revision: 2,
        path: 'owner.ts',
        headBlobOid: 'b'.repeat(40),
      },
      ...(fail
        ? []
        : [{ kind: 'decision', revision: 2, layerId, fingerprint }]),
    ]);
  },
);

it('marks each file in order and stops at the first file that fails', async () => {
  const sent: unknown[] = [];
  const subject = create((path, init) => {
    expect(path).toBe(`/api/reviews/${reviewId}/marks`);
    const body = init?.body;
    const payload: unknown =
      body instanceof Uint8Array
        ? JSON.parse(new TextDecoder().decode(body))
        : null;
    sent.push(payload);
    const refused =
      typeof payload === 'object' &&
      payload !== null &&
      'path' in payload &&
      payload.path === 'moved.ts';
    return Promise.resolve(
      Response.json(
        refused ? { message: 'The selected blob changed' } : { updated: true },
        { status: refused ? 409 : 200 },
      ),
    );
  });
  const command = reviewCommands({
    connection: subject.connection,
    reviewId,
  }).markFiles;
  subject.registry.set(command, {
    revision: 3,
    files: [
      { path: 'row.tsx', headBlobOid: 'b'.repeat(40) },
      { path: 'moved.ts', headBlobOid: 'c'.repeat(40) },
      { path: 'never.css', headBlobOid: 'd'.repeat(40) },
    ],
  });
  await expect(readClientAtom(subject.registry, command)).rejects.toThrow();
  expect(sent).toEqual([
    { kind: 'file', revision: 3, path: 'row.tsx', headBlobOid: 'b'.repeat(40) },
    {
      kind: 'file',
      revision: 3,
      path: 'moved.ts',
      headBlobOid: 'c'.repeat(40),
    },
  ]);
});

it.each([undefined, 'https://github.com/example/project/pull/42'])(
  'sets the review pull request to %s through the connection',
  async (pullRequest) => {
    const sent: unknown[] = [];
    const subject = create((path, init) => {
      expect(path).toBe(`/api/reviews/${reviewId}/pull-request`);
      expect(init?.method).toBe('PUT');
      sent.push(
        init?.body instanceof Uint8Array
          ? JSON.parse(new TextDecoder().decode(init.body))
          : null,
      );
      return Promise.resolve(Response.json({ kind: 'updated' }));
    });
    const command = reviewCommands({
      connection: subject.connection,
      reviewId,
    }).setPullRequest;
    subject.registry.set(command, { pullRequest });
    expect(await readClientAtom(subject.registry, command)).toEqual({
      kind: 'updated',
    });
    expect(sent).toEqual([{ pullRequest: pullRequest ?? null }]);
  },
);
