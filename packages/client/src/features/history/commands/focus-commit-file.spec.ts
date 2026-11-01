import { expect, it } from '@effect/vitest';
import { Effect } from 'effect';
import { scopedClientFixture } from '../../../../spec/kit/client-fixture.ts';
import { historyPlace } from '../queries/history.ts';
import { focusCommitFile } from './focus-commit-file.ts';

it.effect(
  'an explicit file entrance replaces an old commit selection and starts a fresh reading identity',
  () =>
    Effect.gen(function* () {
      const subject = yield* scopedClientFixture(() =>
        Promise.reject(
          new Error('Focusing a file must not request the server'),
        ),
      );
      const selection = {
        connection: subject.connection,
        scope: { projectId: 'project', worktreeId: 'worktree' },
      };
      const request = {
        oid: 'a'.repeat(40),
        parent: 1,
        path: 'historical-a.txt',
      };
      const place = historyPlace({
        ...selection,
        kind: 'commit',
        oid: request.oid,
        parent: 1,
      });
      subject.registry.set(place, {
        ...subject.registry.get(place),
        selected: 'old-b.txt',
        scrollOffset: 480,
      });
      subject.registry.set(focusCommitFile(selection), request);
      expect(subject.registry.get(place)).toMatchObject({
        selected: 'historical-a.txt',
        scrollOffset: 0,
        resetId: 1,
      });
      subject.registry.set(place, {
        ...subject.registry.get(place),
        selected: 'chosen-b.txt',
        scrollOffset: 240,
      });
      subject.registry.set(focusCommitFile(selection), request);
      expect(subject.registry.get(place)).toMatchObject({
        selected: 'historical-a.txt',
        scrollOffset: 0,
        resetId: 2,
      });
    }),
);
