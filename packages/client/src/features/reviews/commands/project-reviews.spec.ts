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
