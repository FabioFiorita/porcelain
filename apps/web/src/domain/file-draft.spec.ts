import { describe, expect, it, vi } from 'vitest';
import { FileDraft } from './file-draft';

describe('file drafts', () => {
  it('serializes saves and waits for text typed while saving before reporting completion', async () => {
    let finish: ((value: string) => void) | undefined;
    const write = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<string>((resolve) => {
            finish = resolve;
          }),
      )
      .mockResolvedValueOnce('fingerprint-c');
    const draft = new FileDraft('a', 'fingerprint-a', write);
    draft.change('b');
    const saving = draft.save();
    draft.change('c');
    expect(draft.save()).toBe(saving);
    finish?.('fingerprint-b');
    expect(await saving).toBe(true);
    expect(write.mock.calls).toEqual([
      ['b', 'fingerprint-a'],
      ['c', 'fingerprint-b'],
    ]);
    expect(draft.snapshot()).toMatchObject({
      text: 'c',
      savedText: 'c',
      saving: false,
    });
  });
  it('keeps failed drafts and their original comparison version for a retry', async () => {
    const failure = new Error('Changed on disk');
    const write = vi
      .fn()
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce('saved');
    const draft = new FileDraft('a', 'original', write);
    draft.change('draft');
    expect(await draft.save()).toBe(false);
    draft.sync('agent change', 'new version');
    expect(draft.snapshot()).toMatchObject({
      text: 'draft',
      savedText: 'a',
      fingerprint: 'original',
      error: failure,
    });
    expect(await draft.save()).toBe(true);
    expect(write).toHaveBeenLastCalledWith('draft', 'original');
  });
});

it('allows one editor per file and keeps its original version when another pane refreshes', () => {
  const draft = new FileDraft('opened', 'original', async () => 'saved');
  expect(draft.claim('left')).toBe(true);
  expect(draft.claim('right')).toBe(false);
  draft.sync('external change', 'external version');
  expect(draft.snapshot()).toMatchObject({
    text: 'opened',
    fingerprint: 'original',
  });
  draft.release('right');
  expect(draft.claim('right')).toBe(false);
  draft.release('left');
  expect(draft.claim('right')).toBe(true);
});
