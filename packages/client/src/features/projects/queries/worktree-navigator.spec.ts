import type { Transport } from '../../../shared/api/transport.ts';
import type { ReadReviewResponse } from '@porcelain/contracts/reviews';
import { expect, it } from 'vitest';
import { Effect, HashMap, Stream } from 'effect';
import { Reactivity, type AtomRegistry } from 'effect/reactivity';
import { ReadSubscriptions } from '../../../shared/api/read-subscriptions.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import {
  clientFixtures,
  idleClientAtoms,
  readClientAtom,
} from '../../../../spec/kit/client-fixture.ts';
import { readPublishedReview } from '../../reviews/queries/publication.ts';
import { readReview } from '../../reviews/queries/project-reviews.ts';
import type { ReviewRecord } from '../../reviews/rules/review.ts';
import { refreshWorktreeNavigator } from '../commands/worktree-navigator.ts';
import { emptyNavigatorFilter } from '../rules/worktree-navigator.ts';
import {
  worktreeNavigatorState,
  worktreeStatusNotices,
} from '../store/worktree-navigator.ts';
import {
  readReviewInbox,
  readReviewNavigator,
  readWorktreeNavigator,
} from './worktree-navigator.ts';

const create = clientFixtures();
const environmentId = '10000000-0000-4000-8000-000000000001';
const secondEnvironmentId = '20000000-0000-4000-8000-000000000001';
const projectId = '30000000-0000-4000-8000-000000000001';
const reviewId = '40000000-0000-4000-8000-000000000001';
const closedReviewId = '50000000-0000-4000-8000-000000000001';
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
            status: null,
          },
          {
            id: mainId,
            path: '/code/main',
            branch: 'main',
            main: true,
            available: true,
            status: null,
          },
        ],
      },
    ],
  };
}
function record(id = reviewId, state: 'open' | 'closed' = 'open') {
  return {
    reviewId: id,
    projectId,
    branch: 'topic',
    state,
    latestRevision: 1,
    lastSeenRevision: 0,
    pullRequest: 'https://github.com/example/project/pull/42',
  };
}
function review(
  worktreeId = topicId,
  worktreePath = '/code/topic',
): ReadReviewResponse {
  return {
    review: record(),
    revisions: [],
    revision: {
      reviewId,
      projectId,
      revision: 1,
      branch: 'topic',
      worktreePath,
      worktreeName: 'topic',
      base: 'main',
      headOid: 'a'.repeat(40),
      baseOid: 'b'.repeat(40),
      mergeBaseOid: 'b'.repeat(40),
      publishedAt: '2026-10-30T00:00:00.000Z',
      files: [],
      verdict: {
        asked: { text: 'A safely scoped review' },
        recommendation: 'hold',
        reasons: ['Review identity must stay scoped'],
        notProven: [],
        removed: [],
      },
      content: {
        environmentId,
        worktreeId,
        revision: 1,
        publishedAt: '2026-10-30T00:00:00.000Z',
        active: true,
        diagnostics: 'current',
        summary: {
          token: 'summary',
          expires: '2026-10-30T01:00:00.000Z',
          signature: 'signature',
          byteLength: 10,
        },
        layers: [
          {
            id: '60000000-0000-4000-8000-000000000001',
            title: 'Keep identity scoped',
            summary: 'Use the checkout identity',
            lanes: ['Client'],
            steps: [
              {
                id: '70000000-0000-4000-8000-000000000001',
                lane: 0,
                title: 'Select the right checkout',
                text: 'Keep the environment and worktree identity',
                kind: 'context',
                pointer: {
                  path: 'README.md',
                  startLine: 1,
                  endLine: 1,
                  textFingerprint: 'f'.repeat(64),
                },
                location: { state: 'current', startLine: 1, endLine: 1 },
              },
            ],
            fingerprint: 'f'.repeat(64),
          },
        ],
        notExplained: [],
        proof: { current: true, checks: [], assets: [] },
      },
    },
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

function wireReview(answer = review()) {
  return {
    ...answer,
    revision: answer.revision
      ? {
          ...answer.revision,
          content: {
            ...answer.revision.content,
            summary: {
              url: '/review-summaries/summary?expires=2026-10-30T01%3A00%3A00.000Z&signature=signature',
              byteLength: 10,
            },
          },
        }
      : null,
  };
}

function navigatorResponse(
  path: string,
  snapshot = inventory(),
  records: readonly ReviewRecord[] = [record()],
  checks: 'passed' | 'failed' = 'passed',
  publishedReviewId: string | null = reviewId,
) {
  return Promise.resolve(
    Response.json(
      path.startsWith('/api/inventory')
        ? snapshot
        : path.endsWith('/review')
          ? {
              review:
                publishedReviewId === null
                  ? null
                  : {
                      ...wireReview().revision?.content,
                      reviewId: publishedReviewId,
                    },
            }
          : path.endsWith('/pull-request/checks')
            ? { kind: 'available', number: 42, checks }
            : path.endsWith('/reviews')
              ? records
              : path.endsWith('/marks')
                ? { files: [], decisions: [] }
                : path.endsWith(reviewId)
                  ? wireReview()
                  : status(path),
    ),
  );
}

function recordedNavigator(
  records: readonly ReviewRecord[] = [record()],
  checks: 'passed' | 'failed' = 'passed',
  publishedReviewId: string | null = reviewId,
  snapshot = inventory(),
) {
  const paths: string[] = [];
  const subject = create(
    (path) => {
      paths.push(path);
      return navigatorResponse(
        path,
        snapshot,
        records,
        checks,
        publishedReviewId,
      );
    },
    undefined,
    1000,
    environmentId,
  );
  return {
    ...subject,
    paths,
    setChecks: (next: 'passed' | 'failed') => {
      checks = next;
    },
  };
}

function observeReviews(records = [record()]) {
  const subject = recordedNavigator(records);
  const list = readReviewNavigator([subject.connection]);
  return {
    ...subject,
    stop: subject.registry.mount(list),
    view: () => subject.registry.get(list),
  };
}

function observeInbox(
  records: readonly ReviewRecord[] = [record()],
  checks: 'passed' | 'failed' = 'passed',
) {
  const subject = recordedNavigator(records, checks);
  const inbox = readReviewInbox([subject.connection]);
  return {
    ...subject,
    stop: subject.registry.mount(inbox),
    view: () => subject.registry.get(inbox),
  };
}

function checkoutReads(paths: readonly string[]) {
  return paths.filter(
    (path) =>
      path.endsWith('/git/status') ||
      path.endsWith('/marks') ||
      path.endsWith('/summary'),
  );
}

function navigatorReviewIds(
  registry: AtomRegistry.AtomRegistry,
  list: ReturnType<typeof readReviewNavigator>,
) {
  return registry
    .get(list)
    .projects[0]?.entries.map((entry) =>
      entry.review.state === 'available' ? entry.review.reviewId : undefined,
    );
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
        : path.endsWith('/reviews')
          ? []
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

it.each([
  { revision: undefined, selectedRevision: 2 },
  { revision: 1, selectedRevision: 1 },
])(
  'validates a cached review on remount without hidden requests while preserving revision selection $revision',
  async ({ revision, selectedRevision }) => {
    let latestRevision = 1;
    let archived = false;
    let missing = false;
    const paths: string[] = [];
    const subject = create(
      (path) => {
        paths.push(path);
        const metadata = {
          ...record(),
          latestRevision,
          archived,
          state: archived ? ('closed' as const) : ('open' as const),
        };
        if (path.endsWith('/reviews'))
          return Promise.resolve(Response.json(missing ? [] : [metadata]));
        if (missing)
          return Promise.resolve(
            Response.json({ review: null, revisions: [], revision: null }),
          );
        const answer = review();
        const selected = revision ?? latestRevision;
        return Promise.resolve(
          Response.json(
            wireReview({
              ...answer,
              review: metadata,
              revision: answer.revision
                ? {
                    ...answer.revision,
                    revision: selected,
                    content: { ...answer.revision.content, revision: selected },
                  }
                : undefined,
            }),
          ),
        );
      },
      undefined,
      1000,
      environmentId,
    );
    const atom = readReview({
      connection: subject.connection,
      reviewId,
      ...(revision === undefined ? {} : { revision }),
    });
    const visit = async () => {
      const stop = subject.registry.mount(atom);
      try {
        return await readClientAtom(subject.registry, atom);
      } finally {
        stop();
        await Effect.runPromise(Effect.yieldNow);
      }
    };
    const detailPath =
      revision === undefined
        ? `/api/reviews/${reviewId}`
        : `/api/reviews/${reviewId}/revisions/${revision}`;
    const detailReads = () =>
      paths.filter((path) => path === detailPath).length;
    expect((await visit()).revision?.revision).toBe(1);
    expect((await visit()).revision?.revision).toBe(1);
    expect(detailReads()).toBe(1);
    const before = [...paths];
    archived = true;
    await subject.connection.runtime.runPromise(
      Reactivity.invalidate([
        queryKeys.inventory(environmentId),
        queryKeys.environment(environmentId),
        queryKeys.durableReview(environmentId, reviewId),
      ]),
    );
    await Effect.runPromise(Effect.yieldNow);
    expect(paths).toEqual(before);
    expect((await visit()).review).toMatchObject({
      state: 'closed',
      archived: true,
      latestRevision: 1,
    });
    expect(detailReads()).toBe(1);
    latestRevision = 2;
    await subject.connection.runtime.runPromise(
      Reactivity.invalidate([queryKeys.durableReview(environmentId, reviewId)]),
    );
    expect(detailReads()).toBe(1);
    const changed = await visit();
    expect(changed.review?.latestRevision).toBe(2);
    expect(changed.revision?.revision).toBe(selectedRevision);
    expect(changed.revision?.content.revision).toBe(selectedRevision);
    expect(detailReads()).toBe(2);
    missing = true;
    await subject.connection.runtime.runPromise(
      Reactivity.invalidate([queryKeys.environment(environmentId)]),
    );
    expect(await visit()).toEqual({
      review: undefined,
      revision: undefined,
      revisions: [],
    });
    expect(detailReads()).toBe(3);
  },
);

it.each(['inventory', 'environment', 'durableReview'] as const)(
  'releases collapsed project subscriptions and makes no hidden detail reads after %s invalidation',
  async (invalidation) => {
    const paths: string[] = [];
    const navigator = observeNavigator((path) => {
      paths.push(path);
      return navigatorResponse(path);
    });
    try {
      await expect
        .poll(() => navigator.view().projects[0]?.entries[1]?.review)
        .toMatchObject({
          state: 'available',
          timing: 'decision',
          latestRevision: 1,
          lastSeenRevision: 0,
        });
      const subscriptions = () =>
        navigator.connection.runtime.runPromise(
          ReadSubscriptions.use((reads) => reads.snapshot),
        );
      expect(HashMap.size(await subscriptions())).toBeGreaterThan(0);
      const released = navigator.connection.runtime.runPromise(
        ReadSubscriptions.use((reads) =>
          Stream.runHead(
            Stream.filter(reads.changes, (state) => HashMap.size(state) === 0),
          ),
        ),
      );
      navigator.registry.set(worktreeNavigatorState, {
        query: '',
        filter: emptyNavigatorFilter,
        expanded: { [projectKey]: false },
      });
      await released;
      await idleClientAtoms(navigator.registry);
      const before = [...paths];
      await navigator.connection.runtime.runPromise(
        Reactivity.invalidate([
          invalidation === 'inventory'
            ? queryKeys.inventory(environmentId)
            : invalidation === 'environment'
              ? queryKeys.environment(environmentId)
              : queryKeys.durableReview(environmentId, reviewId),
        ]),
      );
      await Effect.runPromise(Effect.yieldNow);
      const details = (sent: readonly string[]) =>
        sent.filter((path) => !path.startsWith('/api/inventory'));
      expect(details(paths)).toEqual(details(before));
      navigator.registry.set(worktreeNavigatorState, {
        query: '',
        filter: emptyNavigatorFilter,
        expanded: { [projectKey]: true },
      });
      await expect
        .poll(() => navigator.view().projects[0]?.entries[1]?.review.state)
        .toBe('available');
      await readClientAtom(
        navigator.registry,
        readReview({ connection: navigator.connection, reviewId }),
      );
      expect(
        paths.filter((path) => path === `/api/reviews/${reviewId}`),
      ).toHaveLength(1);
    } finally {
      navigator.stop();
    }
  },
);

it('publishes main-first usable cards while review and changes reads are pending without inventing empty states', async () => {
  let releaseReviews = (_: Response) => {};
  const records = new Promise<Response>((resolve) => {
    releaseReviews = resolve;
  });
  const pending = new Promise<Response>(() => {});
  const subject = create(
    (path) =>
      Promise.resolve(
        path.startsWith('/api/inventory')
          ? Response.json(inventory())
          : path.endsWith('/reviews')
            ? records
            : pending,
      ),
    undefined,
    1000,
    environmentId,
  );
  const list = readWorktreeNavigator([subject.connection]);
  const stop = subject.registry.mount(list);
  try {
    await expectNavigatorNames(subject.registry, list, ['main', 'topic']);
    expect(subject.registry.get(list).loading).toBe(false);
    expect(
      subject.registry
        .get(list)
        .projects[0]?.entries.map((entry) => [
          entry.available,
          entry.review.state,
          entry.changes.state,
        ]),
    ).toEqual([
      [true, 'loading', 'loading'],
      [true, 'loading', 'loading'],
    ]);
    releaseReviews(Response.json([]));
    await expect
      .poll(() =>
        subject.registry
          .get(list)
          .projects[0]?.entries.map((entry) => entry.review.state),
      )
      .toEqual(['none', 'none']);
    expect(
      subject.registry.get(list).projects[0]?.entries[0]?.changes.state,
    ).toBe('loading');
  } finally {
    stop();
  }
});

it.each([
  {
    name: 'the current checkout',
    records: [record()],
    expected: [['topic', reviewId, 'Decision review · New revision']],
  },
  {
    name: 'a deleted checkout',
    records: [record(), { ...record(closedReviewId), branch: 'removed' }],
    expected: [
      ['topic', reviewId, 'Decision review · New revision'],
      ['removed', closedReviewId, 'Decision review · New revision'],
    ],
  },
])(
  'lists open publications for $name in the inbox without Git status, marks or diff summaries',
  async ({ records, expected }) => {
    const subject = recordedNavigator(records);
    const inbox = readReviewInbox([subject.connection]);
    const stop = subject.registry.mount(inbox);
    try {
      await expect
        .poll(() =>
          subject.registry
            .get(inbox)
            .inbox.decisions.map((row) => [
              row.entry.branch,
              row.review.reviewId,
              row.label,
            ]),
        )
        .toEqual(expected);
      expect(subject.registry.get(inbox).inbox.projects).toEqual([]);
      expect(checkoutReads(subject.paths)).toEqual([]);
      expect(subject.paths).not.toContain(`/api/reviews/${closedReviewId}`);
    } finally {
      stop();
    }
  },
);

it.each(['', 'unrelated-worktree'])(
  'shares inbox checks and filters independently of Worktrees search %s and collapsed groups',
  async (query) => {
    const subject = recordedNavigator();
    const inbox = readReviewInbox([subject.connection]);
    subject.registry.set(worktreeNavigatorState, {
      query,
      filter: emptyNavigatorFilter,
      expanded: { [projectKey]: false },
    });
    const stop = subject.registry.mount(inbox);
    try {
      await expect
        .poll(
          () => subject.registry.get(inbox).inbox.decisions[0]?.review.checks,
        )
        .toEqual({ state: 'available', result: 'passed' });
      expect(subject.registry.get(inbox)).toMatchObject({
        filters: [
          { key: 'reviews' },
          {
            key: 'environments',
            items: [{ id: environmentId, checked: true }],
          },
          { key: 'projects', items: [{ id: projectKey, checked: true }] },
        ],
      });
      subject.setChecks('failed');
      const refresh = refreshWorktreeNavigator([subject.connection]);
      subject.registry.set(refresh, undefined);
      await readClientAtom(subject.registry, refresh);
      await expect
        .poll(
          () => subject.registry.get(inbox).inbox.decisions[0]?.review.checks,
        )
        .toEqual({ state: 'available', result: 'failed' });
      expect(checkoutReads(subject.paths)).toEqual([]);
    } finally {
      stop();
    }
  },
);

it.each(['passed', 'failed'] as const)(
  'supplies %s PR checks to inbox rows',
  async (checks) => {
    const subject = observeInbox([record()], checks);
    try {
      await expect
        .poll(() => subject.view().inbox.decisions[0]?.review.checks)
        .toEqual({ state: 'available', result: checks });
    } finally {
      subject.stop();
    }
  },
);

it('leaves checks absent for a publication without a PR', async () => {
  const subject = observeInbox([{ ...record(), pullRequest: undefined }]);
  try {
    await expect.poll(() => subject.view().inbox.decisions.length).toBe(1);
    expect(subject.view().inbox.decisions[0]?.review.checks).toBeUndefined();
    expect(
      subject.paths.some((path) => path.endsWith('/pull-request/checks')),
    ).toBe(false);
  } finally {
    subject.stop();
  }
});

it.each([
  { name: 'project', filter: { ...emptyNavigatorFilter, projects: [] } },
  {
    name: 'environment',
    filter: { ...emptyNavigatorFilter, environments: [] },
  },
  {
    name: 'publication',
    filter: { ...emptyNavigatorFilter, reviews: ['without-review'] },
  },
])('applies the $name filter to the review inbox', async ({ filter }) => {
  const subject = observeInbox();
  try {
    await expect.poll(() => subject.view().inbox.decisions.length).toBe(1);
    subject.registry.set(worktreeNavigatorState, {
      query: '',
      filter,
      expanded: {},
    });
    expect(subject.view().inbox.decisions).toEqual([]);
  } finally {
    subject.stop();
  }
});

it('waits for a candidate checkout association while keeping unrelated saved reviews reachable', async () => {
  const requested = Promise.withResolvers<void>();
  const released = Promise.withResolvers<Response>();
  const records = [
    record(),
    { ...record(closedReviewId), branch: 'deleted-branch' },
  ];
  const subject = create(
    (path) => {
      if (path.endsWith('/review')) {
        requested.resolve();
        return released.promise;
      }
      return navigatorResponse(path, inventory(), records);
    },
    undefined,
    1000,
    environmentId,
  );
  const list = readReviewNavigator([subject.connection]);
  const inbox = readReviewInbox([subject.connection]);
  const stopList = subject.registry.mount(list);
  const stopInbox = subject.registry.mount(inbox);
  try {
    await requested.promise;
    await idleClientAtoms(subject.registry);
    expect(
      subject.registry
        .get(list)
        .projects.flatMap((project) =>
          project.entries.map((entry) => entry.key),
        ),
    ).toEqual([`${environmentId}/${closedReviewId}`]);
    expect(
      subject.registry
        .get(inbox)
        .inbox.decisions.map((row) => row.review.reviewId),
    ).toEqual([closedReviewId]);
    expect(subject.registry.get(inbox).loading).toBe(true);
    released.resolve(await navigatorResponse('/api/worktrees/topic/review'));
    await expect
      .poll(() =>
        subject.registry
          .get(list)
          .projects.flatMap((project) =>
            project.entries.map((entry) => [
              entry.key,
              entry.worktreeId,
              entry.path,
            ]),
          ),
      )
      .toEqual([
        [`${environmentId}/${reviewId}`, topicId, '/code/topic'],
        [`${environmentId}/${closedReviewId}`, undefined, undefined],
      ]);
    expect(
      subject.registry
        .get(inbox)
        .inbox.decisions.map((row) => [
          row.review.reviewId,
          row.entry.worktreeId,
        ]),
    ).toEqual([
      [reviewId, topicId],
      [closedReviewId, undefined],
    ]);
    expect(subject.registry.get(inbox).loading).toBe(false);
  } finally {
    released.resolve(await navigatorResponse('/api/worktrees/topic/review'));
    stopList();
    stopInbox();
  }
});

it('links only the exact current publication to an available checkout', async () => {
  const subject = observeReviews([record(), record(closedReviewId)]);
  try {
    await expect
      .poll(() =>
        subject
          .view()
          .projects[0]?.entries.map((entry) => [
            entry.review.state === 'available' ? entry.review.reviewId : '',
            entry.worktreeId,
            entry.path,
          ]),
      )
      .toEqual([
        [reviewId, topicId, '/code/topic'],
        [closedReviewId, undefined, undefined],
      ]);
    expect(subject.paths.some((path) => path.endsWith('/git/status'))).toBe(
      false,
    );
  } finally {
    subject.stop();
  }
});

it.each([null, closedReviewId])(
  'does not link a saved review when the checkout publishes %s instead',
  async (publishedReviewId) => {
    const subject = recordedNavigator([record()], 'passed', publishedReviewId);
    const list = readReviewNavigator([subject.connection]);
    const stop = subject.registry.mount(list);
    try {
      await readClientAtom(
        subject.registry,
        readPublishedReview({
          connection: subject.connection,
          scope: { projectId, worktreeId: topicId },
        }),
      );
      await idleClientAtoms(subject.registry);
      expect(
        subject.registry.get(list).projects[0]?.entries[0]?.worktreeId,
      ).toBeUndefined();
    } finally {
      stop();
    }
  },
);

it('refreshes a review-only navigator without mounting hidden checkout reads', async () => {
  const subject = observeReviews();
  try {
    await expect.poll(() => subject.view().projects[0]?.entries.length).toBe(1);
    const refresh = refreshWorktreeNavigator([subject.connection]);
    subject.registry.set(refresh, undefined);
    await readClientAtom(subject.registry, refresh);
    expect(checkoutReads(subject.paths)).toEqual([]);
  } finally {
    subject.stop();
  }
});

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
      .poll(() => registry.get(list).projects[0]?.entries[0]?.review.state)
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
      .poll(() => registry.get(list).projects[0]?.entries[0]?.review.state)
      .toBe('none');
    registry.set(refreshWorktreeNavigator(connections), undefined);
    await readClientAtom(registry, refreshWorktreeNavigator(connections));
    await expect
      .poll(
        () =>
          reads.filter(
            (read) =>
              read.environmentId === secondEnvironmentId &&
              read.path.endsWith('/reviews'),
          ).length,
      )
      .toBe(2);
    expect(
      reads.filter(
        (read) =>
          read.environmentId === environmentId &&
          read.path.endsWith('/reviews'),
      ),
    ).toHaveLength(1);
    registry.set(worktreeNavigatorState, {
      query: '',
      filter: { ...emptyNavigatorFilter, reviews: [] },
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

it('requires checkout path and identity before associating a PR, and keeps closed publications in Reviews history', async () => {
  let answer = review(mainId);
  const subject = create(
    (path) =>
      Promise.resolve(
        Response.json(
          path.startsWith('/api/inventory')
            ? inventory()
            : path.endsWith('/pull-request/checks')
              ? { kind: 'available', number: 42, checks: 'passed' }
              : path.endsWith('/reviews')
                ? [record(), record(closedReviewId, 'closed')]
                : path.endsWith('/marks')
                  ? {
                      files: [],
                      decisions: [
                        {
                          layerId: '60000000-0000-4000-8000-000000000001',
                          fingerprint: 'f'.repeat(64),
                          reviewedAt: '2026-10-30T00:00:00.000Z',
                          stale: true,
                        },
                      ],
                    }
                  : path.endsWith(reviewId)
                    ? {
                        ...wireReview(answer),
                      }
                    : status(path),
        ),
      ),
    undefined,
    1000,
    environmentId,
  );
  const connections = [subject.connection];
  const list = readWorktreeNavigator(connections);
  const stop = subject.registry.mount(list);
  const currentReview = () =>
    subject.registry.get(list).projects[0]?.entries[1]?.review;
  const reread = async (next: ReadReviewResponse) => {
    answer = next;
    subject.registry.set(refreshWorktreeNavigator(connections), undefined);
    await readClientAtom(
      subject.registry,
      refreshWorktreeNavigator(connections),
    );
  };
  try {
    await readClientAtom(
      subject.registry,
      readReview({ connection: subject.connection, reviewId }),
    );
    await expect.poll(() => currentReview()?.state).toBe('none');
    expect(
      subject.registry
        .get(list)
        .projects[0]?.entries.map((entry) => entry.kind),
    ).toEqual(['worktree', 'worktree']);
    await reread(review(topicId, '/code/elsewhere'));
    await expect.poll(() => currentReview()?.state).toBe('none');
    await reread(review());
    await expect.poll(currentReview).toMatchObject({
      state: 'available',
      reviewId,
      pullRequestNumber: 42,
      timing: 'decision',
      latestRevision: 1,
      lastSeenRevision: 0,
    });
    const reviews = readReviewNavigator(connections);
    const stopReviews = subject.registry.mount(reviews);
    try {
      await expect
        .poll(() => navigatorReviewIds(subject.registry, reviews))
        .toEqual([reviewId]);
      subject.registry.set(worktreeNavigatorState, {
        query: '',
        filter: { ...emptyNavigatorFilter, older: true },
        expanded: {},
      });
      await expect
        .poll(() => navigatorReviewIds(subject.registry, reviews))
        .toEqual([reviewId, closedReviewId]);
      expect(
        subject.registry
          .get(list)
          .projects[0]?.entries.map((entry) => entry.kind),
      ).toEqual(['worktree', 'worktree']);
    } finally {
      stopReviews();
    }
    expect(subject.registry.get(list).projects[0]?.entries[0]?.name).toBe(
      'main',
    );
  } finally {
    stop();
  }
});

it.each(['records', 'review'])(
  'recovers a failed %s read on the same connection through Read again',
  async (failedRead) => {
    let fail = true;
    const navigator = observeNavigator((path) => {
      if (
        fail &&
        (failedRead === 'records'
          ? path.endsWith('/reviews')
          : path.endsWith(reviewId))
      )
        return Promise.resolve(
          new Response('Temporarily unavailable', { status: 503 }),
        );
      return navigatorResponse(path);
    });
    try {
      await expect
        .poll(() => navigator.view().projects[0]?.entries[1]?.review.state)
        .toBe('unavailable');
      expect(navigator.view().messages).not.toEqual([]);
      fail = false;
      await navigator.refresh();
      await expect
        .poll(() => navigator.view().projects[0]?.entries[1]?.review)
        .toMatchObject({
          state: 'available',
          reviewId,
          timing: 'decision',
          latestRevision: 1,
          lastSeenRevision: 0,
        });
      expect(navigator.view().messages).toEqual([]);
    } finally {
      navigator.stop();
    }
  },
);

it('keeps a readable review reachable when its checkout is unavailable without enabling checkout selection', async () => {
  const snapshot = inventory();
  snapshot.projects[0]!.worktrees[0]!.available = false;
  const reads: string[] = [];
  const navigator = observeNavigator((path) => {
    reads.push(path);
    return navigatorResponse(path, snapshot);
  });
  try {
    await expect
      .poll(() => navigator.view().projects[0]?.entries[1])
      .toMatchObject({
        kind: 'worktree',
        available: false,
        worktreeId: topicId,
        changes: { state: 'unavailable' },
        review: {
          state: 'available',
          reviewId,
          timing: 'decision',
          latestRevision: 1,
          lastSeenRevision: 0,
        },
      });
    expect(reads.some((path) => path.includes(topicId))).toBe(false);
  } finally {
    navigator.stop();
  }
});

it('keeps open publications independent of live checkout branches and preserves multiple reviews of one checkout', async () => {
  const records = [
    record(),
    record(closedReviewId),
    {
      ...record('80000000-0000-4000-8000-000000000001'),
      branch: 'removed-checkout',
    },
  ];
  const subject = observeReviews(records);
  try {
    await expect
      .poll(() =>
        subject
          .view()
          .projects[0]?.entries.map((entry) => [
            entry.kind,
            entry.branch,
            entry.review.state === 'available'
              ? entry.review.reviewId
              : undefined,
          ]),
      )
      .toEqual([
        ['review', 'topic', reviewId],
        ['review', 'topic', closedReviewId],
        ['review', 'removed-checkout', '80000000-0000-4000-8000-000000000001'],
      ]);
    expect(checkoutReads(subject.paths)).toEqual([]);
  } finally {
    subject.stop();
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
      if (path.endsWith('/reviews'))
        return reviewsReady.then(() => Response.json([record()]));
      if (path.endsWith('/pull-request/checks'))
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
      return Promise.resolve(Response.json(wireReview()));
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
        review: { state: 'available', checks: { state: 'loading' } },
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
        review: { checks: { state: 'available', result: 'running' } },
      });
    const refresh = refreshWorktreeNavigator([subject.connection]);
    subject.registry.set(refresh, undefined);
    await readClientAtom(subject.registry, refresh);
    await expect
      .poll(
        () =>
          reads.filter((path) => path.endsWith('/pull-request/checks')).length,
      )
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
    if (path.endsWith('/pull-request/checks'))
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
        review: { checks: { state: 'unavailable' } },
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
    const subject = recordedNavigator([], 'passed', null, snapshot);
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
