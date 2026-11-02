import { Effect, Option, Stream } from 'effect';
import { AtomRegistry, Reactivity } from 'effect/reactivity';
import { expect, it } from 'vitest';
import {
  clientFixtures,
  idleClientAtoms,
} from '../../../../spec/kit/client-fixture.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import type { ReviewGitSettingsView } from '../rules/review-git-settings.ts';
import { confirmedReviewGitSettings } from '../rules/review-git-settings.ts';
import {
  readReviewGitSettingsView,
  reviewGitSettingsTrust,
} from './review-git-settings.ts';

const create = clientFixtures();
const saved = {
  kind: 'configured',
  revision: 1,
  settings: {
    pullStrategy: 'rebase',
    collapseSpecs: true,
    archiveDeleteWorktree: false,
    archiveDeleteLocalBranch: true,
    archiveDeleteRemoteBranch: false,
  },
} as const;

function nextView(
  registry: AtomRegistry.AtomRegistry,
  view: ReturnType<typeof readReviewGitSettingsView>,
  accepts: (value: ReviewGitSettingsView) => boolean,
) {
  return Effect.runPromise(
    AtomRegistry.toStream(registry, view).pipe(
      Stream.filter(accepts),
      Stream.take(1),
      Stream.runHead,
      Effect.map(Option.getOrThrow),
    ),
  );
}

it('keeps each computer’s confirmed settings visible while switching back refreshes them', async () => {
  const held = Promise.withResolvers<Response>();
  const started = Promise.withResolvers<void>();
  let reads = 0;
  const first = create(() => {
    if (++reads === 1) return Promise.resolve(Response.json(saved));
    started.resolve();
    return held.promise;
  });
  const otherSaved = {
    ...saved,
    settings: { ...saved.settings, pullStrategy: 'merge' },
  };
  const other = create(() => Promise.resolve(Response.json(otherSaved)));
  const registry = first.registry;
  const firstView = readReviewGitSettingsView(first.connection);
  const otherView = readReviewGitSettingsView(other.connection);
  const stopFirst = registry.mount(firstView);
  expect(
    await nextView(registry, firstView, (view) => view.kind === 'configured'),
  ).toEqual({ ...saved, unreadable: undefined });
  stopFirst();
  await idleClientAtoms(registry);
  first.connection.runtime.runSync(
    Reactivity.invalidate([
      queryKeys.environment(first.connection.environmentId),
    ]),
  );
  await idleClientAtoms(registry);
  expect(reads).toBe(1);
  const stopOther = registry.mount(otherView);
  expect(
    await nextView(registry, otherView, (view) => view.kind === 'configured'),
  ).toEqual({ ...otherSaved, unreadable: undefined });
  stopOther();
  await idleClientAtoms(registry);
  const stop = registry.mount(firstView);
  try {
    await started.promise;
    expect(registry.get(firstView)).toEqual({
      ...saved,
      unreadable: undefined,
    });
    const refreshed = nextView(
      registry,
      firstView,
      (view) => view.kind === 'configured' && view.revision === 2,
    );
    held.resolve(Response.json({ ...saved, revision: 2 }));
    expect(await refreshed).toEqual({
      ...saved,
      revision: 2,
      unreadable: undefined,
    });
    expect(reads).toBe(2);
  } finally {
    held.resolve(Response.json(saved));
    stop();
  }
});

it('does not check update permissions for configured settings but still checks them before first-use import', async () => {
  const requests: string[] = [];
  let configured = true;
  const subject = create((path) => {
    requests.push(path);
    return Promise.resolve(
      Response.json(
        path === '/api/review-git-settings'
          ? configured
            ? saved
            : { kind: 'unconfigured' }
          : {
              managed: true,
              available: false,
              version: '1.0.0',
              latest: null,
              last: null,
              running: false,
              canUpdate: false,
            },
      ),
    );
  });
  const registry = subject.registry;
  const view = readReviewGitSettingsView(subject.connection);
  const trust = reviewGitSettingsTrust(subject.connection);
  const stop = registry.mount(trust);
  try {
    await nextView(registry, view, (value) => value.kind === 'configured');
    expect(registry.get(trust)).toBeUndefined();
    expect(requests).toEqual(['/api/review-git-settings']);
    configured = false;
    subject.connection.runtime.runSync(
      Reactivity.invalidate([
        queryKeys.reviewGitSettings(subject.connection.environmentId),
      ]),
    );
    const blocked = await Effect.runPromise(
      AtomRegistry.toStream(registry, trust).pipe(
        Stream.filter((value) => value?.includes('owner must trust') === true),
        Stream.take(1),
        Stream.runHead,
      ),
    );
    expect(Option.getOrThrow(blocked)).toBe(
      'An owner must trust this device on the computer that runs Porcelain before it can change Reviews & Git settings.',
    );
    expect(requests).toEqual([
      '/api/review-git-settings',
      '/api/review-git-settings',
      '/api/service/update',
    ]);
  } finally {
    stop();
  }
});

it('a permission failure disables confirmed settings and a recovery read restores them', async () => {
  let denied = false;
  const subject = create(() =>
    Promise.resolve(
      denied ? new Response(null, { status: 403 }) : Response.json(saved),
    ),
  );
  const registry = subject.registry;
  const view = readReviewGitSettingsView(subject.connection);
  const stop = registry.mount(view);
  try {
    await nextView(registry, view, (value) => value.kind === 'configured');
    denied = true;
    const failed = nextView(
      registry,
      view,
      (value) => value.kind === 'configured' && value.unreadable !== undefined,
    );
    subject.connection.runtime.runSync(
      Reactivity.invalidate([
        queryKeys.environment(subject.connection.environmentId),
      ]),
    );
    const blocked = await failed;
    expect(confirmedReviewGitSettings(blocked)).toBeUndefined();
    expect(blocked).toMatchObject({
      kind: 'configured',
      settings: saved.settings,
    });
    denied = false;
    const recovered = nextView(
      registry,
      view,
      (value) => value.kind === 'configured' && value.unreadable === undefined,
    );
    subject.connection.runtime.runSync(
      Reactivity.invalidate([
        queryKeys.environment(subject.connection.environmentId),
      ]),
    );
    expect(confirmedReviewGitSettings(await recovered)).toEqual(saved.settings);
  } finally {
    stop();
  }
});
