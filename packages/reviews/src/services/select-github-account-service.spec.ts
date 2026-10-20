import { Effect, Layer } from 'effect';
import { expect, it } from 'vitest';
import { GitHubReadError } from '../errors/github-read-error.ts';
import { GitHubReader } from '../ports/github-reader.ts';
import { GitHubAccountStore } from '../ports/github-account-store.ts';
import { InMemoryGitHubAccountStore } from '../../spec/fakes/in-memory-github-account-store.ts';
import { githubPullRequest } from '../../spec/fixtures/github-pull-request.ts';
import { SelectGitHubAccountService } from './select-github-account-service.ts';
function subject(
  accounts: readonly string[] = ['personal', 'work'],
  readable: readonly string[] = ['personal'],
  failure?: GitHubReadError['reason'],
  failures: Readonly<Record<string, GitHubReadError['reason']>> = {},
) {
  const store = new InMemoryGitHubAccountStore();
  const probes: string[] = [];
  const reader: GitHubReader = {
    accounts: () =>
      failure === 'gh-not-installed'
        ? Effect.fail(new GitHubReadError({ reason: failure }))
        : Effect.succeed(accounts),
    canRead: ({ account }) =>
      Effect.suspend(() => {
        probes.push(account);
        const reason = failures[account] ?? failure;
        return reason === undefined
          ? Effect.succeed(readable.includes(account))
          : Effect.fail(new GitHubReadError({ reason }));
      }),
    read: () => Effect.succeed(githubPullRequest()),
    list: () => Effect.succeed({ open: [], recent: [], truncated: false }),
  };
  const layer = SelectGitHubAccountService.layer.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(GitHubReader, reader),
        Layer.succeed(GitHubAccountStore, store),
      ),
    ),
  );
  return {
    store,
    probes,
    read: () =>
      Effect.runPromise(
        Effect.flatMap(SelectGitHubAccountService, (service) =>
          service.execute({ projectId: 'project', owner: 'a', repo: 'b' }),
        ).pipe(Effect.provide(layer)),
      ),
  };
}
it('tries accounts, persists the accessible choice and probes that choice first on subsequent reads', async () => {
  const s = subject(['personal', 'work'], ['work']);
  expect(await s.read()).toEqual({
    accounts: ['personal', 'work'],
    choice: { account: 'work', source: 'detected' },
    override: undefined,
    unavailable: undefined,
  });
  expect(s.store.preferences.get('project')).toEqual({
    repository: 'a/b',
    detected: 'work',
    override: undefined,
  });
  expect(await s.read()).toMatchObject({ choice: { account: 'work' } });
  expect(s.probes).toEqual(['personal', 'work', 'work']);
});
it('keeps an inaccessible override until explicitly cleared', async () => {
  const s = subject();
  await Effect.runPromise(
    s.store.override({
      projectId: 'project',
      repository: 'a/b',
      account: 'work',
    }),
  );
  expect(await s.read()).toMatchObject({
    choice: undefined,
    override: 'work',
    unavailable: { reason: 'no-access' },
  });
  expect(s.probes).toEqual(['work']);
  await Effect.runPromise(
    s.store.override({
      projectId: 'project',
      repository: 'a/b',
      account: undefined,
    }),
  );
  expect(await s.read()).toMatchObject({
    choice: { account: 'personal', source: 'detected' },
    override: undefined,
  });
});
it.each([
  'gh-not-installed',
  'rate-limited',
  'offline',
  'invalid-response',
] as const)('reports %s without an exception', async (reason) => {
  expect(
    await subject(['personal'], ['personal'], reason).read(),
  ).toMatchObject({
    choice: undefined,
    unavailable: { kind: 'unavailable', reason },
  });
});
it.each([
  [[], [], 'no-accounts'],
  [['personal'], [], 'no-access'],
] as const)(
  'reports no accounts or no access without an exception',
  async (accounts, readable, reason) => {
    expect(await subject(accounts, readable).read()).toMatchObject({
      choice: undefined,
      unavailable: { kind: 'unavailable', reason },
    });
  },
);

it('tries another logged-in account when the first account is rate limited', async () => {
  const s = subject(['personal', 'work'], ['personal', 'work'], undefined, {
    personal: 'rate-limited',
  });
  expect(await s.read()).toMatchObject({
    choice: { account: 'work', source: 'detected' },
  });
  expect(s.probes).toEqual(['personal', 'work']);
});
it('redetects when a remembered account loses access', async () => {
  const readable = ['work'];
  const s = subject(['personal', 'work'], readable);
  expect(await s.read()).toMatchObject({ choice: { account: 'work' } });
  readable.splice(0, 1, 'personal');
  expect(await s.read()).toMatchObject({ choice: { account: 'personal' } });
  expect(s.probes).toEqual(['personal', 'work', 'work', 'personal']);
});
