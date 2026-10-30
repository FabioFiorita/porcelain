import type { Transport } from '../../../shared/api/transport.ts';
import type { ReadReviewResponse } from '@porcelain/contracts/reviews';
import { expect, it } from 'vitest';
import {
  clientFixtures,
  readClientAtom,
} from '../../../../spec/kit/client-fixture.ts';
import { readReview } from '../../reviews/queries/project-reviews.ts';
import { refreshWorktreeNavigator } from '../commands/worktree-navigator.ts';
import {
  emptyNavigatorFilter,
  navigatorReviewLabel,
} from '../rules/worktree-navigator.ts';
import { worktreeNavigatorState } from '../store/worktree-navigator.ts';
import { readWorktreeNavigator } from './worktree-navigator.ts';

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
  records = [record()],
) {
  return Promise.resolve(
    Response.json(
      path.startsWith('/api/inventory')
        ? snapshot
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
    await expect
      .poll(() =>
        subject.registry
          .get(list)
          .projects[0]?.entries.map((entry) => entry.name),
      )
      .toEqual(['main', 'topic']);
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

it('keeps colliding projects distinct and mounts no hidden-project details or GitHub payloads, including refresh', async () => {
  const reads: { environmentId: string; path: string }[] = [];
  const subjects = [environmentId, secondEnvironmentId].map((identity) =>
    create(
      (path) => {
        reads.push({ environmentId: identity, path });
        return Promise.resolve(
          Response.json(
            path.startsWith('/api/inventory')
              ? inventory(
                  identity,
                  identity === environmentId ? 'Desk' : 'Laptop',
                )
              : path.endsWith('/reviews')
                ? []
                : { ...status(path), environmentId: identity },
          ),
        );
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

it('requires both checkout path and identity before associating progress or a PR, and reveals retained reviews only on request', async () => {
  let answer = review(mainId);
  const subject = create(
    (path) =>
      Promise.resolve(
        Response.json(
          path.startsWith('/api/inventory')
            ? inventory()
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
      progress: { reviewed: 1, total: 1 },
    });
    subject.registry.set(worktreeNavigatorState, {
      query: '',
      filter: { ...emptyNavigatorFilter, older: true },
      expanded: {},
    });
    await expect
      .poll(() =>
        subject.registry
          .get(list)
          .projects[0]?.entries.filter((entry) => entry.kind === 'review')
          .map((entry) => entry.review),
      )
      .toEqual([
        {
          state: 'available',
          reviewId: closedReviewId,
          closed: true,
          archived: false,
          pullRequestNumber: 42,
          progress: undefined,
          retained: true,
        },
      ]);
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
          progress: { reviewed: 0, total: 1 },
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
          progress: { reviewed: 0, total: 1 },
        },
      });
    expect(reads.some((path) => path.includes(topicId))).toBe(false);
  } finally {
    navigator.stop();
  }
});

it('settles an open retained review without a permanent progress skeleton or heavy detail reads', async () => {
  const reads: string[] = [];
  const navigator = observeNavigator((path) => {
    reads.push(path);
    return navigatorResponse(path, inventory(), [
      { ...record(), branch: 'removed-checkout' },
    ]);
  });
  try {
    await expect
      .poll(() => navigator.view().projects[0]?.entries[1]?.review.state)
      .toBe('none');
    navigator.registry.set(worktreeNavigatorState, {
      query: '',
      filter: { ...emptyNavigatorFilter, older: true },
      expanded: {},
    });
    const retained = navigator.view().projects[0]?.entries[2];
    expect(retained?.kind).toBe('review');
    expect(navigatorReviewLabel(retained!.review)).toBe('Retained review');
    expect(reads.some((path) => path.includes(reviewId))).toBe(false);
  } finally {
    navigator.stop();
  }
});
