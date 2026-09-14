import { filePreferencesResponseSchema } from '@porcelain/contracts/file-preferences';
import { expect, it } from 'vitest';
import { createMockStore } from '../inventory/mock';
import { createFilePreferencesMock } from './mock';

const projectId = 'fac0e50f-b019-4e46-9dd1-efcb6af7dc09';
const request = {
  projectId,
  token: 'fixture-token',
  signal: new AbortController().signal,
};

it('lists isolated project preferences and returns cloned snapshots', async () => {
  const store = createMockStore();
  store.filePreferences[projectId] = [
    { path: 'src/hidden.ts', pinned: false, hidden: true },
  ];
  const api = createFilePreferencesMock(store);
  const result = await api.list(request);

  expect(filePreferencesResponseSchema.safeParse(result).success).toBe(true);
  result.preferences.length = 0;
  expect(store.filePreferences[projectId]).toHaveLength(1);
  await expect(
    api.list({ ...request, projectId: 'fac0e50f-b019-4e46-9dd1-efcb6af7dc10' }),
  ).resolves.toEqual({ preferences: [] });
});

it('updates hidden and pinned flags independently and removes empty entries', async () => {
  const store = createMockStore();
  const api = createFilePreferencesMock(store);

  await expect(
    api.set({
      ...request,
      input: { path: 'src/hidden.ts', flag: 'hidden', value: true },
    }),
  ).resolves.toEqual({
    preferences: [{ path: 'src/hidden.ts', pinned: false, hidden: true }],
  });
  await expect(
    api.set({
      ...request,
      input: { path: 'src/hidden.ts', flag: 'pinned', value: true },
    }),
  ).resolves.toEqual({
    preferences: [{ path: 'src/hidden.ts', pinned: true, hidden: true }],
  });
  await expect(
    api.set({
      ...request,
      input: { path: 'src/hidden.ts', flag: 'hidden', value: false },
    }),
  ).resolves.toEqual({
    preferences: [{ path: 'src/hidden.ts', pinned: true, hidden: false }],
  });
  await expect(
    api.set({
      ...request,
      input: { path: 'src/hidden.ts', flag: 'pinned', value: false },
    }),
  ).resolves.toEqual({ preferences: [] });
});

it('does not persist a delayed preference after cancellation', async () => {
  const store = createMockStore('slow');
  const controller = new AbortController();
  const pending = createFilePreferencesMock(store).set({
    ...request,
    signal: controller.signal,
    input: { path: 'src/hidden.ts', flag: 'hidden', value: true },
  });
  controller.abort();
  await expect(pending).rejects.toThrow();
  expect(store.filePreferences[projectId]).toBeUndefined();
});
