import { expect, it, vi } from 'vitest';
import { createFilePreferencesLive } from './live';

const projectId = 'fac0e50f-b019-4e46-9dd1-efcb6af7dc09';
const request = {
  projectId,
  token: 'fixture-token',
  signal: new AbortController().signal,
};
const response = {
  preferences: [
    { path: 'src/hidden.ts', pinned: false, hidden: true },
    { path: 'README.md', pinned: true, hidden: false },
  ],
};

it('lists and sets project preferences through the authenticated API', async () => {
  const transport = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json(response))
    .mockResolvedValueOnce(Response.json(response));
  const api = createFilePreferencesLive(transport);

  await expect(api.list(request)).resolves.toEqual(response);
  await expect(
    api.set({
      ...request,
      input: { path: 'src/hidden.ts', flag: 'hidden', value: false },
    }),
  ).resolves.toEqual(response);

  expect(transport).toHaveBeenNthCalledWith(
    1,
    `/api/projects/${projectId}/file-preferences`,
    expect.objectContaining({
      method: 'GET',
      headers: { authorization: 'Bearer fixture-token' },
      signal: request.signal,
      redirect: 'error',
      credentials: 'omit',
      cache: 'no-store',
    }),
  );
  expect(transport).toHaveBeenNthCalledWith(
    2,
    `/api/projects/${projectId}/file-preferences`,
    expect.objectContaining({
      method: 'PUT',
      headers: {
        authorization: 'Bearer fixture-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        path: 'src/hidden.ts',
        flag: 'hidden',
        value: false,
      }),
    }),
  );
});

it.each([
  [401, 'Access token was rejected'],
  [500, 'could not be loaded or saved'],
  [200, 'incompatible file preferences'],
] as const)(
  'reports a safe error for status %i and malformed data',
  async (status, message) => {
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('{}', { status }));
    await expect(
      createFilePreferencesLive(transport).list(request),
    ).rejects.toThrow(message);
  },
);

it('preserves an aborted transport error and hides network diagnostics', async () => {
  const cause = new Error('private network detail');
  const transport = vi.fn<typeof fetch>().mockRejectedValue(cause);
  await expect(
    createFilePreferencesLive(transport).list(request),
  ).rejects.toThrow('Could not reach file preferences');
  await expect(
    createFilePreferencesLive(transport).set({
      ...request,
      input: { path: 'src/hidden.ts', flag: 'hidden', value: true },
    }),
  ).rejects.toMatchObject({ cause });

  const controller = new AbortController();
  controller.abort();
  const aborted = new Error('aborted');
  await expect(
    createFilePreferencesLive(
      vi.fn<typeof fetch>().mockRejectedValue(aborted),
    ).list({ ...request, signal: controller.signal }),
  ).rejects.toBe(aborted);
});
