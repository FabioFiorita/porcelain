import { expect, it } from 'vitest';
import {
  activateDocument,
  closeDocument,
  emptyDocuments,
  openDocument,
} from './document-tabs';

it('opens distinct documents and activates an existing tab without duplicating it', () => {
  const one = openDocument(emptyDocuments(), { key: 'README.md' });
  const two = openDocument(one, { key: 'src/main.ts' });
  const reopened = openDocument(two, { key: 'README.md' });
  expect(reopened).toEqual({
    tabs: [{ key: 'README.md' }, { key: 'src/main.ts' }],
    active: 'README.md',
  });
  expect(activateDocument(reopened, 'src/main.ts').active).toBe('src/main.ts');
  expect(activateDocument(reopened, 'missing')).toBe(reopened);
});

it('closing the selected document activates its next neighbour, then previous, then the empty workspace', () => {
  const state = {
    tabs: [{ key: 'a' }, { key: 'b' }, { key: 'c' }],
    active: 'b',
  };
  const next = closeDocument(state, 'b');
  expect(next).toEqual({ tabs: [{ key: 'a' }, { key: 'c' }], active: 'c' });
  const previous = closeDocument(next, 'c');
  expect(previous).toEqual({ tabs: [{ key: 'a' }], active: 'a' });
  expect(closeDocument(previous, 'a')).toEqual({ tabs: [], active: null });
});

it('closing another document preserves the selection, and a missing document changes nothing', () => {
  const state = { tabs: [{ key: 'a' }, { key: 'b' }], active: 'a' };
  expect(closeDocument(state, 'b')).toEqual({
    tabs: [{ key: 'a' }],
    active: 'a',
  });
  expect(closeDocument(state, 'missing')).toBe(state);
  expect(state.tabs).toEqual([{ key: 'a' }, { key: 'b' }]);
});
