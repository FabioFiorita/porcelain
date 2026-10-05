import { Effect } from 'effect';
import { nativeOperation } from '@porcelain/effects';
import { ContentChangedError } from '@porcelain/files/errors';
import { describe, expect, it } from 'vitest';
import { ConnectionError } from '@porcelain/client/transport';
import { FileDraft } from './store.ts';

describe('portable file draft', () => {
  it('saves changes made during a write against the newly confirmed fingerprint', async () => {
    const firstWrite = Promise.withResolvers<string>();
    const writes: { text: string; fingerprint: string }[] = [];
    const draft = new FileDraft(
      'original',
      'version-1',
      (text, fingerprint) => {
        writes.push({ text, fingerprint });
        return nativeOperation(() =>
          writes.length === 1
            ? firstWrite.promise
            : Promise.resolve('version-3'),
        );
      },
      () => false,
    );
    try {
      draft.change('first edit');
      const saving = Effect.runPromise(draft.save());
      const following = Effect.runPromise(draft.save());
      draft.change('second edit');
      firstWrite.resolve('version-2');
      expect(await saving).toBe(true);
      expect(await following).toBe(true);
      expect(writes).toEqual([
        { text: 'first edit', fingerprint: 'version-1' },
        { text: 'second edit', fingerprint: 'version-2' },
      ]);
      expect(draft.snapshot()).toMatchObject({
        text: 'second edit',
        savedText: 'second edit',
        fingerprint: 'version-3',
        saving: false,
        error: null,
      });
    } finally {
      await Effect.runPromise(draft.dispose());
    }
  });

  it('retains a conflicting draft and refuses another write until explicit reset', async () => {
    const conflict = new ContentChangedError();
    let writes = 0;
    const draft = new FileDraft('original', 'version-1', () => {
      writes += 1;
      return Effect.fail(conflict);
    });
    try {
      draft.change('unsaved');
      expect(await Effect.runPromise(draft.save())).toBe(false);
      expect(draft.blocked).toBe(true);
      expect(await Effect.runPromise(draft.save())).toBe(false);
      expect(writes).toBe(1);
      expect(draft.snapshot()).toMatchObject({
        text: 'unsaved',
        savedText: 'original',
        fingerprint: 'version-1',
        error: conflict,
      });
      draft.reset('disk version', 'version-2');
      expect(draft.blocked).toBe(false);
      expect(draft.snapshot()).toMatchObject({
        text: 'disk version',
        savedText: 'disk version',
        fingerprint: 'version-2',
        error: null,
      });
    } finally {
      await Effect.runPromise(draft.dispose());
    }
  });

  it('admits only one editor owner and ignores another owner releasing it', async () => {
    const draft = new FileDraft(
      'text',
      'version',
      () => Effect.succeed('saved'),
      () => false,
    );
    try {
      expect(draft.claim('web')).toBe(true);
      expect(draft.claim('mobile')).toBe(false);
      draft.release('mobile');
      expect(draft.snapshot().owner).toBe('web');
      draft.release('web');
      expect(draft.claim('mobile')).toBe(true);
    } finally {
      await Effect.runPromise(draft.dispose());
    }
  });

  it('keeps ownership and avoids saving when an editor reattaches during cleanup', async () => {
    let writes = 0;
    let notifications = 0;
    let detachments = 0;
    const draft = new FileDraft(
      'text',
      'version',
      () => {
        writes += 1;
        return Effect.succeed('saved');
      },
      () => false,
    );
    try {
      draft.claim('editor');
      draft.change('draft');
      draft.attachEditor('editor');
      const cleanup = Effect.runPromise(
        draft.finishEditing(
          'editor',
          () => {
            notifications += 1;
          },
          () => {
            detachments += 1;
          },
        ),
      );
      draft.attachEditor('editor');
      await cleanup;
      expect(draft.snapshot().owner).toBe('editor');
      expect(writes).toBe(0);
      expect(notifications).toBe(0);
      expect(detachments).toBe(0);
    } finally {
      await Effect.runPromise(draft.dispose());
    }
  });

  it('releases a detached editor and retains its draft when saving fails', async () => {
    const failure = new ConnectionError({ message: 'Offline' });
    const draft = new FileDraft(
      'text',
      'version',
      () => Effect.fail(failure),
      () => false,
    );
    let notifications = 0;
    let detachments = 0;
    try {
      draft.claim('editor');
      draft.attachEditor('editor');
      draft.change('unsaved');
      await Effect.runPromise(
        draft.finishEditing(
          'editor',
          () => {
            notifications += 1;
          },
          () => {
            detachments += 1;
          },
        ),
      );
      expect(draft.snapshot()).toMatchObject({
        owner: null,
        text: 'unsaved',
        savedText: 'text',
        error: failure,
      });
      expect(notifications).toBe(1);
      expect(detachments).toBe(1);
    } finally {
      await Effect.runPromise(draft.dispose());
    }
  });
});
