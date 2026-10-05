import { describe, expect, it } from 'vitest';
import type { Principal } from '@porcelain/contracts/access';
import { sessionQueryOptions } from './session.ts';

const inventory = {
  environmentId: '11111111-1111-4111-8111-111111111111',
  environment: { name: 'Computer', custom: false },
  projects: [],
};

describe('browser session restoration', () => {
  it.each<Principal>([
    { kind: 'owner' },
    { kind: 'device', deviceId: '22222222-2222-4222-8222-222222222222' },
  ])(
    'restores the authenticated writer together with its workspace: $kind',
    async (principal) => {
      const paths: string[] = [];
      const query = sessionQueryOptions((path) => {
        paths.push(path);
        return Promise.resolve(
          Response.json(path === '/api/session' ? principal : inventory),
        );
      });
      const restored = await query.queryFn({
        signal: new AbortController().signal,
      });
      expect(restored).toEqual({ inventory, principal });
      expect(paths).toEqual(['/api/session', '/api/inventory']);
    },
  );

  it('returns an unpaired session without attempting an authenticated inventory read', async () => {
    const paths: string[] = [];
    const query = sessionQueryOptions((path) => {
      paths.push(path);
      return Promise.resolve(new Response(null, { status: 401 }));
    });
    expect(
      await query.queryFn({ signal: new AbortController().signal }),
    ).toBeNull();
    expect(paths).toEqual(['/api/session']);
  });

  it('refuses a workspace when the server cannot identify its authenticated writer', async () => {
    let reads = 0;
    const query = sessionQueryOptions(() => {
      reads += 1;
      return Promise.resolve(Response.json({ kind: 'device' }));
    });
    await expect(
      query.queryFn({ signal: new AbortController().signal }),
    ).rejects.toThrow('restore this browser session');
    expect(reads).toBe(1);
  });
});
