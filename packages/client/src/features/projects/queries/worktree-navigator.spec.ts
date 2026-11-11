import type { Transport } from '../../../shared/api/transport.ts';
import { expect, it } from 'vitest';
import { type AtomRegistry } from 'effect/reactivity';
import {
  clientFixtures,
  idleClientAtoms,
  readClientAtom,
} from '../../../../spec/kit/client-fixture.ts';
import { refreshWorktreeNavigator } from '../commands/worktree-navigator.ts';
import { emptyNavigatorFilter } from '../rules/worktree-navigator.ts';
import {
  worktreeNavigatorState,
  worktreeStatusNotices,
} from '../store/worktree-navigator.ts';
import { readWorktreeNavigator } from './worktree-navigator.ts';
import { readProjectPullRequests } from './pull-requests.ts';

const create = clientFixtures();
const environmentId = '10000000-0000-4000-8000-000000000001';
const secondEnvironmentId = '20000000-0000-4000-8000-000000000001';
const projectId = '30000000-0000-4000-8000-000000000001';
const mainId = 'a'.repeat(32);
const topicId = 'b'.repeat(32);
const projectKey = `${environmentId}/${projectId}`;

function inventory(identity = environmentId, name = 'Desk') {
  return {
    environmentId: identity,
    environment: { name, custom: true },
    projects: [
      {
        id: projectId,
        name: 'Porcelain',
        available: true,
        worktrees: [
          {
            id: topicId,
            path: '/code/topic',
            branch: 'topic',
            main: false,
            available: true,
          },
          {
            id: mainId,
            path: '/code/main',
            branch: 'main',
            main: true,
            available: true,
          },
        ],
      },
    ],
  };
}
function status(path: string) {
  return {
    environmentId,
    worktreeId: path.includes(mainId) ? mainId : topicId,
    statusToken: 'f'.repeat(64),
    consistency: 'best-effort',
    headOid: null,
    inProgress: null,
    mergeHeadOid: null,
    headCommit: null,
    changes: [],
  };
}

function pullList() {
  return {
    kind: 'available',
    account: 'fixture',
    pullRequests: [
      {
        number: 42,
        title: 'Topic change',
        url: 'https://github.com/example/project/pull/42',
        state: 'open',
        draft: false,
        headBranch: 'topic',
        baseBranch: 'main',
        checksTruncated: false,
        updatedAt: '2026-11-10T00:00:00Z',
      },
    ],
    truncated: false,
    recentlyClosedSince: '2026-11-01T00:00:00Z',
  };
}
function navigatorResponse(path: string, snapshot = inventory()) {
  return Promise.resolve(
    Response.json(
      path.startsWith('/api/inventory')
        ? snapshot
        : path.endsWith('/pull-requests')
          ? pullList()
          : path.endsWith('/checks')
            ? { kind: 'available', number: 42, checks: 'passed' }
            : status(path),
    ),
  );
}
function recordedNavigator(snapshot = inventory()) {
  const paths: string[] = [];
  const subject = create(
    (path) => {
      paths.push(path);
      return navigatorResponse(path, snapshot);
    },
    undefined,
    1000,
    environmentId,
  );
  return { ...subject, paths };
}
function identityResponse(
  path: string,
  identity: string,
  snapshot = inventory(
    identity,
    identity === environmentId ? 'Desk' : 'Laptop',
  ),
) {
  return Promise.resolve(
    Response.json(
      path.startsWith('/api/inventory')
        ? snapshot
        : path.endsWith('/pull-requests')
          ? { ...pullList(), pullRequests: [] }
          : { ...status(path), environmentId: identity },
    ),
  );
}
function observeNavigator(transport: Transport) {
  const subject = create(transport, undefined, 1000, environmentId);
  const connections = [subject.connection];
  const list = readWorktreeNavigator(connections);
  return {
    ...subject,
    stop: subject.registry.mount(list),
    view: () => subject.registry.get(list),
    refresh: async () => {
      subject.registry.set(refreshWorktreeNavigator(connections), undefined);
      await readClientAtom(
        subject.registry,
        refreshWorktreeNavigator(connections),
      );
    },
  };
}

function topicEntry(navigator: ReturnType<typeof observeNavigator>) {
  return navigator
    .view()
    .projects[0]?.entries.find((row) => row.worktreeId === topicId);
}

function expectNavigatorNames(
  registry: AtomRegistry.AtomRegistry,
  list: ReturnType<typeof readWorktreeNavigator>,
  names: readonly string[],
) {
  return expect
    .poll(() =>
      registry.get(list).projects[0]?.entries.map((entry) => entry.name),
    )
    .toEqual(names);
}

it('keeps colliding projects distinct and mounts no hidden-project details or GitHub payloads, including refresh', async () => {
  const reads: { environmentId: string; path: string }[] = [];
  const subjects = [environmentId, secondEnvironmentId].map((identity) =>
    create(
      (path) => {
        reads.push({ environmentId: identity, path });
        return identityResponse(path, identity);
      },
      undefined,
      1000,
      identity,
    ),
  );
  const registry = subjects[0]!.registry;
  registry.set(worktreeNavigatorState, {
    query: '',
    filter: emptyNavigatorFilter,
    expanded: {
      [projectKey]: false,
      [`${secondEnvironmentId}/${projectId}`]: false,
    },
  });
  const connections = subjects.map((subject) => subject.connection);
  const list = readWorktreeNavigator(connections);
  const stop = registry.mount(list);
  try {
    await expect.poll(() => registry.get(list).allProjects.length).toBe(2);
    expect(registry.get(list).projects.map((project) => project.key)).toEqual([
      projectKey,
      `${secondEnvironmentId}/${projectId}`,
    ]);
    expect(reads.every(({ path }) => path.startsWith('/api/inventory'))).toBe(
      true,
    );
    registry.set(worktreeNavigatorState, {
      query: '',
      filter: { ...emptyNavigatorFilter, environments: [environmentId] },
      expanded: { [projectKey]: true },
    });
    await expect
      .poll(() => registry.get(list).projects[0]?.entries[0]?.pullRequest.state)
      .toBe('none');
    expect(
      reads
        .filter((read) => read.environmentId === secondEnvironmentId)
        .every(({ path }) => path.startsWith('/api/inventory')),
    ).toBe(true);
    expect(registry.get(list).allProjects).toHaveLength(2);
    const secondProjectKey = `${secondEnvironmentId}/${projectId}`;
    registry.set(worktreeNavigatorState, {
      query: '',
      filter: { ...emptyNavigatorFilter, projects: [secondProjectKey] },
      expanded: {},
    });
    await expect
      .poll(() => registry.get(list).projects[0]?.key)
      .toBe(secondProjectKey);
    await expect
      .poll(() => registry.get(list).projects[0]?.entries[0]?.pullRequest.state)
      .toBe('none');
    registry.set(refreshWorktreeNavigator(connections), undefined);
    await readClientAtom(registry, refreshWorktreeNavigator(connections));
    await expect
      .poll(
        () =>
          reads.filter(
            (read) =>
              read.environmentId === secondEnvironmentId &&
              read.path.endsWith('/pull-requests'),
          ).length,
      )
      .toBe(2);
    expect(
      reads.filter(
        (read) =>
          read.environmentId === environmentId &&
          read.path.endsWith('/pull-requests'),
      ),
    ).toHaveLength(1);
    registry.set(worktreeNavigatorState, {
      query: '',
      filter: { ...emptyNavigatorFilter, projects: [] },
      expanded: {},
    });
    expect(registry.get(list).projects).toEqual([]);
    expect(registry.get(list).allProjects).toHaveLength(2);
    expect(reads.some(({ path }) => path.endsWith('/pull-request'))).toBe(
      false,
    );
  } finally {
    stop();
  }
});

it('loads checks after useful cards without computing diff summaries or reading hidden cards', async () => {
  let releaseStatus = () => {};
  let releaseReviews = () => {};
  let releaseChecks = (_: Response) => {};
  const statusReady = new Promise<void>((resolve) => {
    releaseStatus = resolve;
  });
  const reviewsReady = new Promise<void>((resolve) => {
    releaseReviews = resolve;
  });
  const checks = new Promise<Response>((resolve) => {
    releaseChecks = resolve;
  });
  const reads: string[] = [];
  const subject = create(
    (path) => {
      reads.push(path);
      if (path.startsWith('/api/inventory'))
        return Promise.resolve(Response.json(inventory()));
      if (path.endsWith('/pull-requests'))
        return reviewsReady.then(() => Response.json(pullList()));
      if (path.endsWith('/checks'))
        return checks.then((response) => response.clone());
      if (path.endsWith('/git/status'))
        return statusReady.then(() =>
          Response.json({
            ...status(path),
            changes: [{ scope: 'untracked', path: 'pending.txt' }],
          }),
        );
      if (path.endsWith('/marks'))
        return Promise.resolve(Response.json({ files: [], decisions: [] }));
      return Promise.resolve(Response.json(status(path)));
    },
    undefined,
    1000,
    environmentId,
  );
  subject.registry.set(worktreeNavigatorState, {
    query: 'topic',
    filter: emptyNavigatorFilter,
    expanded: {},
  });
  const list = readWorktreeNavigator([subject.connection]);
  const stop = subject.registry.mount(list);
  try {
    await expectNavigatorNames(subject.registry, list, ['topic']);
    expect(
      reads.filter(
        (path) => path.endsWith('/summary') || path.endsWith('/checks'),
      ),
    ).toEqual([]);
    releaseStatus();
    releaseReviews();
    await expect
      .poll(() => subject.registry.get(list).projects[0]?.entries[0])
      .toMatchObject({
        changes: {
          state: 'available',
          count: 1,
        },
        pullRequest: { state: 'available', checks: { state: 'loading' } },
      });
    expect(reads.filter((path) => path.endsWith('/summary'))).toEqual([]);
    expect(reads.some((path) => path.endsWith('/pull-request'))).toBe(false);
    releaseChecks(
      Response.json({ kind: 'available', number: 42, checks: 'running' }),
    );
    await expect
      .poll(() => subject.registry.get(list).projects[0]?.entries[0])
      .toMatchObject({
        changes: { state: 'available', count: 1 },
        pullRequest: { checks: { state: 'available', result: 'running' } },
      });
    const refresh = refreshWorktreeNavigator([subject.connection]);
    subject.registry.set(refresh, undefined);
    await readClientAtom(subject.registry, refresh);
    await expect
      .poll(() => reads.filter((path) => path.endsWith('/checks')).length)
      .toBe(2);
    expect(reads.filter((path) => path.endsWith('/summary'))).toEqual([]);
  } finally {
    stop();
  }
});

it('refuses checks for another pull request without reading a diff summary', async () => {
  const paths: string[] = [];
  const navigator = observeNavigator((path) => {
    paths.push(path);
    if (path.endsWith('/checks'))
      return Promise.resolve(
        Response.json({ kind: 'available', number: 99, checks: 'passed' }),
      );
    if (path.endsWith('/git/status'))
      return Promise.resolve(
        Response.json({
          ...status(path),
          changes: path.includes(topicId)
            ? [{ scope: 'untracked', path: 'pending.txt' }]
            : [],
        }),
      );
    return navigatorResponse(path);
  });
  try {
    await expect
      .poll(() => navigator.view().projects[0]?.entries[1])
      .toMatchObject({
        changes: { state: 'available', count: 1 },
        pullRequest: { checks: { state: 'unavailable' } },
      });
    expect(paths.filter((path) => path.endsWith('/summary'))).toEqual([]);
  } finally {
    navigator.stop();
  }
});

it('groups status failures by computer and retries only that computer after inventory reconciliation', async () => {
  let fail = true;
  let removed = false;
  const reads: { identity: string; path: string }[] = [];
  const subjects = [environmentId, secondEnvironmentId].map((identity) =>
    create(
      (path) => {
        reads.push({ identity, path });
        const snapshot = inventory(
          identity,
          identity === environmentId ? 'Desk' : 'Laptop',
        );
        if (removed && identity === environmentId)
          snapshot.projects[0]!.worktrees =
            snapshot.projects[0]!.worktrees.filter(
              (worktree) => worktree.id !== topicId,
            );
        if (fail && identity === environmentId && path.endsWith('/git/status'))
          return Promise.resolve(
            Response.json(
              {
                statusCode: 503,
                error: 'Service Unavailable',
                message: 'Inspection failed',
              },
              { status: 503 },
            ),
          );
        return identityResponse(path, identity, snapshot);
      },
      undefined,
      1000,
      identity,
    ),
  );
  const registry = subjects[0]!.registry;
  const connections = subjects.map((subject) => subject.connection);
  const list = readWorktreeNavigator(connections);
  const stop = registry.mount(list);
  const refresh = refreshWorktreeNavigator(connections);
  try {
    await expect
      .poll(() =>
        registry.get(list).statusIssues.map((issue) => ({
          name: issue.environmentName,
          failures: issue.failures.map(({ entry, detail }) => ({
            name: entry.name,
            detail,
          })),
        })),
      )
      .toEqual([
        {
          name: 'Desk',
          failures: [
            { name: 'main', detail: 'Inspection failed' },
            { name: 'topic', detail: 'Inspection failed' },
          ],
        },
      ]);
    await expect
      .poll(() =>
        registry
          .get(list)
          .projects.find(
            (project) =>
              project.connection.environmentId === secondEnvironmentId,
          )
          ?.entries.map((entry) => entry.changes),
      )
      .toEqual([
        {
          state: 'available',
          count: 0,
        },
        {
          state: 'available',
          count: 0,
        },
      ]);
    expect(registry.get(list).messages).toEqual([]);
    reads.length = 0;
    removed = true;
    fail = false;
    registry.set(refresh, { environmentId });
    await readClientAtom(registry, refresh);
    await expect.poll(() => registry.get(list).statusIssues).toEqual([]);
    expect(
      registry
        .get(list)
        .projects.find(
          (project) => project.connection.environmentId === environmentId,
        )
        ?.entries.map((entry) => entry.name),
    ).toEqual(['main']);
    expect(reads).toEqual([
      { identity: environmentId, path: '/api/inventory/refresh' },
      { identity: environmentId, path: `/api/worktrees/${mainId}/git/status` },
    ]);
  } finally {
    stop();
  }
});

it('keeps scoped retry pending until status reads settle and retains only failures that remain', async () => {
  let recovering = false;
  const requested = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const navigator = observeNavigator(async (path) => {
    if (!path.endsWith('/git/status')) return navigatorResponse(path);
    if (recovering && path.includes(mainId)) {
      requested.resolve();
      await release.promise;
      return navigatorResponse(path);
    }
    return Response.json(
      {
        statusCode: recovering ? 403 : 503,
        error: recovering ? 'Forbidden' : 'Service Unavailable',
        message: recovering ? 'Access denied' : 'Inspection failed',
      },
      { status: recovering ? 403 : 503 },
    );
  });
  const refresh = refreshWorktreeNavigator([navigator.connection]);
  try {
    await expect
      .poll(() => navigator.view().statusIssues[0]?.failures.length)
      .toBe(2);
    recovering = true;
    navigator.registry.set(refresh, { environmentId });
    const completion = readClientAtom(navigator.registry, refresh);
    await requested.promise;
    expect(navigator.registry.get(refresh).waiting).toBe(true);
    release.resolve();
    await completion;
    expect(navigator.registry.get(refresh).waiting).toBe(false);
    expect(
      navigator.view().statusIssues[0]?.failures.map(({ entry, detail }) => ({
        name: entry.name,
        detail,
      })),
    ).toEqual([{ name: 'topic', detail: 'Access denied' }]);
    expect(navigator.view().projects[0]?.entries[0]?.changes.state).toBe(
      'available',
    );
  } finally {
    release.resolve();
    navigator.stop();
  }
});

it('keeps failed scopes and dismissal across collapse and remount, then retries them without hidden background reads', async () => {
  let fail = true;
  const paths: string[] = [];
  const navigator = observeNavigator((path) => {
    paths.push(path);
    if (fail && path.endsWith('/git/status'))
      return Promise.resolve(new Response('Unavailable', { status: 503 }));
    return navigatorResponse(path);
  });
  const list = readWorktreeNavigator([navigator.connection]);
  let stop = navigator.stop;
  try {
    await expect
      .poll(() => navigator.view().statusIssues[0]?.failures.length)
      .toBe(2);
    navigator.registry.update(worktreeStatusNotices, (notices) =>
      notices.map((notice) => ({ ...notice, dismissed: true })),
    );
    navigator.registry.set(worktreeNavigatorState, {
      query: '',
      filter: emptyNavigatorFilter,
      expanded: { [projectKey]: false },
    });
    await idleClientAtoms(navigator.registry);
    paths.length = 0;
    stop();
    await idleClientAtoms(navigator.registry);
    stop = navigator.registry.mount(list);
    await expect.poll(() => navigator.view().projects[0]?.expanded).toBe(false);
    expect(navigator.registry.get(worktreeStatusNotices)[0]?.dismissed).toBe(
      true,
    );
    expect(paths.filter((path) => path.endsWith('/git/status'))).toEqual([]);
    fail = false;
    const refresh = refreshWorktreeNavigator([navigator.connection]);
    navigator.registry.set(refresh, { environmentId });
    await readClientAtom(navigator.registry, refresh);
    expect(navigator.registry.get(worktreeStatusNotices)).toEqual([]);
    expect(navigator.view().statusIssues).toEqual([]);
    expect(paths.filter((path) => path.endsWith('/git/status')).sort()).toEqual(
      [
        `/api/worktrees/${mainId}/git/status`,
        `/api/worktrees/${topicId}/git/status`,
      ].sort(),
    );
  } finally {
    stop();
  }
});

it.each([
  ['Walkthrough title', 'PR title', 'Walkthrough title'],
  [undefined, 'PR title', 'PR title'],
  [undefined, undefined, undefined],
  ['topic', 'PR title', undefined],
] as const)(
  'shows the title fallback %s / %s and searches title or branch',
  async (walkthroughTitle, pullRequestTitle, expected) => {
    const snapshot = inventory();
    Object.assign(snapshot.projects[0]?.worktrees[0] ?? {}, {
      walkthroughTitle,
      pullRequestTitle,
    });
    const subject = recordedNavigator(snapshot);
    const list = readWorktreeNavigator([subject.connection]);
    const stop = subject.registry.mount(list);
    try {
      await expectNavigatorNames(subject.registry, list, ['main', 'topic']);
      const entry = subject.registry
        .get(list)
        .projects[0]?.entries.find((entry) => entry.worktreeId === topicId);
      expect(entry?.displayTitle).toBe(expected);
      expect(entry?.name).toBe('topic');
      expect(entry?.branch).toBe('topic');
      subject.registry.set(worktreeNavigatorState, {
        ...subject.registry.get(worktreeNavigatorState),
        query: expected ?? 'topic',
      });
      expect(
        subject.registry
          .get(list)
          .projects[0]?.entries.map((entry) => entry.worktreeId),
      ).toEqual([topicId]);
      subject.registry.set(worktreeNavigatorState, {
        ...subject.registry.get(worktreeNavigatorState),
        query: 'topic',
      });
      expect(
        subject.registry
          .get(list)
          .projects[0]?.entries.map((entry) => entry.worktreeId),
      ).toEqual([topicId]);
    } finally {
      stop();
    }
  },
);

it.each(['rate-limited', 'transport'] as const)(
  'keeps the known PR through pending and %s lists until an authoritative list removes it',
  async (failure) => {
    let next: Promise<Response> | undefined;
    const navigator = observeNavigator((path) =>
      path.endsWith('/pull-requests') && next ? next : navigatorResponse(path),
    );
    const list = readProjectPullRequests({
      connection: navigator.connection,
      projectId,
    });
    const entry = () => topicEntry(navigator);
    try {
      await expect
        .poll(() => entry()?.pullRequest)
        .toMatchObject({ state: 'available', number: 42 });
      const order = navigator.view().projects[0]?.entries.map((row) => row.key);
      const pending = Promise.withResolvers<Response>();
      next = pending.promise;
      navigator.registry.refresh(list);
      await idleClientAtoms(navigator.registry);
      expect(entry()?.pullRequest).toMatchObject({
        state: 'available',
        number: 42,
      });
      pending.resolve(
        failure === 'rate-limited'
          ? Response.json({ kind: 'unavailable', reason: 'rate-limited' })
          : new Response('Unavailable', { status: 503 }),
      );
      await expect.poll(() => navigator.registry.get(list).waiting).toBe(false);
      expect(entry()?.pullRequest).toMatchObject({
        state: 'available',
        number: 42,
      });
      expect(
        navigator.view().projects[0]?.entries.map((row) => row.key),
      ).toEqual(order);
      next = Promise.resolve(
        Response.json({ ...pullList(), pullRequests: [] }),
      );
      navigator.registry.refresh(list);
      await expect.poll(() => entry()?.pullRequest).toEqual({ state: 'none' });
    } finally {
      navigator.stop();
    }
  },
);

it('does not carry a known PR onto a changed branch when GitHub is unavailable', async () => {
  const snapshot = inventory();
  let unavailable = false;
  const navigator = observeNavigator((path) =>
    unavailable && path.endsWith('/pull-requests')
      ? Promise.resolve(
          Response.json({ kind: 'unavailable', reason: 'rate-limited' }),
        )
      : navigatorResponse(path, snapshot),
  );
  const entry = () => topicEntry(navigator);
  try {
    await expect
      .poll(() => entry()?.pullRequest)
      .toMatchObject({ state: 'available', number: 42 });
    unavailable = true;
    snapshot.projects[0]!.worktrees[0]!.branch = 'another-topic';
    await navigator.refresh();
    await expect.poll(() => entry()?.branch).toBe('another-topic');
    await expect
      .poll(() => entry()?.pullRequest)
      .toEqual({ state: 'unavailable' });
  } finally {
    navigator.stop();
  }
});
