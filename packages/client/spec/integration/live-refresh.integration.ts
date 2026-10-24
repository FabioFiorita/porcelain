import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { expect } from 'vitest';
import { Effect, Equal, Layer, Schema } from 'effect';
import { readPublishedReviewResponseSchema } from '@porcelain/contracts/reviews';
import { NodeCrypto } from '@effect/platform-node';
import { AtomRegistry, type Atom, type AsyncResult } from 'effect/reactivity';
import { test } from '@porcelain/server/kit/server-test';
import { record, text } from '@porcelain/server/kit/session';
import {
  read,
  sampleReview,
  commitReviewFixture,
  toolCall,
  toolValue,
} from '@porcelain/server/kit/requests';
import {
  readReview,
  readReviewMarks,
  readReviewComments,
  readReviewPullRequest,
  readProjectReviews,
  reviewCommands,
} from '@porcelain/client/reviews';
import { liveQueries, type LiveUpdatePort } from '@porcelain/client/live';
import { OperationStore } from '@porcelain/client/git-actions';
import { readInventory } from '@porcelain/client/projects';
import { createWorktreeConnection } from '@porcelain/client/transport';
import { connection } from '../kit/connection.ts';
import { readClientAtom } from '../kit/client-fixture.ts';
import { operationStoreFixture } from '../kit/operation-store.ts';
import { controlledPromise } from '../kit/promise.ts';

test.for([
  'files',
  'git',
  'review',
  'reviewed',
  'comments',
  'fetch receipt',
  'commit receipt',
  'initial review read',
] as const)(
  '%s refreshes only its review while open and closed history stays mounted',
  async (change, { server, session }) => {
    await commitReviewFixture(session);
    const sibling = join(
      session.projectHome,
      `retained-${change.replaceAll(' ', '-')}`,
    );
    const other = join(
      session.projectHome,
      `other-project-${change.replaceAll(' ', '-')}`,
    );
    await session.git(
      'worktree',
      'add',
      '-b',
      `retained-${change.replaceAll(' ', '-')}`,
      sibling,
    );
    execFileSync('git', [
      'clone',
      '--quiet',
      '--no-hardlinks',
      session.repository,
      other,
    ]);
    execFileSync('git', [
      '-C',
      other,
      'branch',
      'porcelain-fixture-base',
      'HEAD~1',
    ]);
    await read(session, {
      method: 'POST',
      path: '/api/projects',
      body: { path: other },
    });
    const existing = Schema.decodeUnknownSync(
      readPublishedReviewResponseSchema,
    )(
      await read(session, {
        method: 'GET',
        path: `/api/worktrees/${session.worktreeId}/review`,
      }),
    );
    const publications = [];
    for (const [index, cwd] of [session.repository, sibling, other].entries()) {
      const publish = toolCall(
        session,
        index + 1,
        'publish_review',
        sampleReview(
          session,
          index === 0 ? (existing.review?.revision ?? 0) : 0,
          '75dc6a36-a001-4d00-b511-c45430b99403',
          '75dc6a36-a001-4d00-b511-c45430b99404',
        ),
      );
      publish.headers = { ...publish.headers, 'x-porcelain-cwd': cwd };
      const published = record(toolValue(await read(session, publish)));
      publications.push({
        reviewId: text(published.reviewId),
        worktreeId: text(record(published.review).worktreeId),
      });
    }
    const [a, b, c] = publications;
    if (!a || !b || !c) throw new Error('Missing review fixtures');
    await read(session, {
      method: 'PATCH',
      path: `/api/reviews/${c.reviewId}`,
      body: { state: 'closed' },
    });
    const { connected: base } = await connection(server, session);
    const requests: string[] = [];
    let holdReview = false;
    const held = controlledPromise<Response>();
    const captured = controlledPromise<Response>();
    let holdInitialReview = change === 'initial review read';
    const initialHeld = controlledPromise<Response>();
    const initialCaptured = controlledPromise<Response>();
    const { store: operations } = operationStoreFixture();
    const lifetime = createWorktreeConnection(
      {
        environmentId: base.environmentId,
        timeoutMs: 15_000,
        transport: async (path, init) => {
          requests.push(`${init?.method ?? 'GET'} ${path}`);
          const response = await base.transport(path, init);
          if (holdInitialReview && path === `/api/reviews/${a.reviewId}`) {
            holdInitialReview = false;
            initialCaptured.resolve(response);
            return initialHeld.promise;
          }
          if (holdReview && path === `/api/reviews/${a.reviewId}`) {
            holdReview = false;
            captured.resolve(response);
            return held.promise;
          }
          return response;
        },
      },
      undefined,
      Layer.merge(NodeCrypto.layer, Layer.succeed(OperationStore, operations)),
    );
    const subject = { ...lifetime, registry: AtomRegistry.make() };
    let callbacks: Parameters<LiveUpdatePort['connect']>[0] | undefined;
    const liveUpdates: LiveUpdatePort = {
      connect: (options) =>
        Effect.sync(() => {
          callbacks = options;
          return { subscribe: () => {} };
        }),
    };
    const connected = Equal.byReference({
      ...subject.connection,
      operations,
      liveUpdates,
    });
    const inputs = publications.map(({ reviewId }) => ({
      connection: connected,
      reviewId,
    }));
    const reviewAtoms = inputs.map((input) => [
      readReview(input),
      readReviewMarks(input),
      readReviewComments(input),
      readReviewPullRequest(input),
    ]);
    const inventory = readInventory(connected);
    const inventoryResult = await readClientAtom(subject.registry, inventory);
    const lists = inventoryResult.projects.map(({ id }) =>
      readProjectReviews({ connection: connected, projectId: id }),
    );
    type Failure = AsyncResult.AsyncResult.Failure<
      Atom.Type<
        | (typeof reviewAtoms)[number][number]
        | (typeof lists)[number]
        | typeof inventory
      >
    >;
    const atoms: Atom.Atom<AsyncResult.AsyncResult<unknown, Failure>>[] = [
      ...reviewAtoms.flat(),
      ...lists,
      inventory,
    ];
    const stops = atoms.map((atom) => subject.registry.mount(atom));
    const live = liveQueries({ connection: connected });
    stops.push(subject.registry.mount(live));
    const settle = () =>
      Promise.all(
        atoms.map((atom) =>
          Effect.runPromise(
            AtomRegistry.getResult(subject.registry, atom, {
              suspendOnWaiting: true,
            }),
          ),
        ),
      );
    const counts = (reviewId: string) =>
      requests.filter((path) =>
        path.startsWith(`GET /api/reviews/${reviewId}`),
      );
    try {
      await readClientAtom(subject.registry, live);
      if (change === 'initial review read') {
        const initialResponse = await initialCaptured.promise;
        const otherInput = inputs[1];
        const closedInput = inputs[2];
        const currentInput = inputs[0];
        if (!otherInput || !closedInput || !currentInput)
          throw new Error('Missing initial review inputs');
        await readClientAtom(subject.registry, readReview(otherInput));
        await readClientAtom(subject.registry, readReview(closedInput));
        const revision = (existing.review?.revision ?? 0) + 1;
        await read(session, {
          method: 'PUT',
          path: `/api/reviews/${a.reviewId}/seen`,
          body: { revision },
        });
        callbacks?.onNotice({
          type: 'worktree',
          projectId: session.projectId,
          worktreeId: a.worktreeId,
          change: 'reviewed',
        });
        initialHeld.resolve(initialResponse);
        expect(
          (await readClientAtom(subject.registry, readReview(currentInput)))
            .review?.lastSeenRevision,
        ).toBe(revision);
      }
      await settle();
      const closedInput = inputs[2];
      if (!closedInput) throw new Error('Missing closed review');
      expect(
        await readClientAtom(subject.registry, readReview(closedInput)),
      ).toMatchObject({ review: { state: 'closed' } });
      const bReads = counts(b.reviewId);
      const cReads = counts(c.reviewId);
      expect(bReads).toHaveLength(4);
      expect(cReads).toHaveLength(4);
      const otherProject = inventoryResult.projects.find((project) =>
        project.worktrees.some((worktree) => worktree.id === c.worktreeId),
      );
      if (!otherProject) throw new Error('Missing second project');
      const otherList = `GET /api/projects/${otherProject.id}/reviews`;
      const otherLists = requests.filter((path) => path === otherList).length;
      const before = counts(a.reviewId).length;
      if (change === 'fetch receipt' || change === 'commit receipt') {
        const receipt = {
          projectId: session.projectId,
          worktreeId: a.worktreeId,
          requestId: '22222222-2222-4222-8222-222222222222',
          action:
            change === 'fetch receipt'
              ? ('fetch' as const)
              : ('commit' as const),
          state: 'succeeded' as const,
          acceptedAt: '2026-10-23T00:00:00.000Z',
          progress: [],
        };
        callbacks?.onNotice({
          type: 'git-action',
          projectId: session.projectId,
          worktreeId: a.worktreeId,
          receipt,
        });
      } else
        callbacks?.onNotice({
          type: 'worktree',
          projectId: session.projectId,
          worktreeId: a.worktreeId,
          change: change === 'initial review read' ? 'files' : change,
        });
      await expect
        .poll(() => counts(a.reviewId).length)
        .toBeGreaterThan(before);
      await settle();
      expect(counts(b.reviewId)).toEqual(bReads);
      expect(counts(c.reviewId)).toEqual(cReads);
      expect(requests.filter((path) => path === otherList)).toHaveLength(
        otherLists,
      );
      const aInput = inputs[0];
      if (!aInput) throw new Error('Missing active review');
      const current = await readClientAtom(
        subject.registry,
        readReview(aInput),
      );
      const layer = current.revision?.content.layers[0];
      const revision = current.revision?.revision;
      if (!layer || !revision) throw new Error('Missing decision');
      const mark = reviewCommands(aInput).mark;
      subject.registry.set(mark, {
        kind: 'decision',
        revision,
        layerId: layer.id,
        fingerprint: layer.fingerprint,
      });
      expect(await readClientAtom(subject.registry, mark)).toEqual({
        updated: true,
      });
      await settle();
      expect(
        (await readClientAtom(subject.registry, readReviewMarks(aInput)))
          .decisions,
      ).toHaveLength(1);
      expect(counts(b.reviewId)).toEqual(bReads);
      expect(counts(c.reviewId)).toEqual(cReads);
      expect(requests.filter((path) => path === otherList)).toHaveLength(
        otherLists,
      );
      const metadataReads = () =>
        requests.filter((path) => path === `GET /api/reviews/${a.reviewId}`)
          .length;
      const beforeHeld = metadataReads();
      holdReview = true;
      callbacks?.onNotice({
        type: 'worktree',
        projectId: session.projectId,
        worktreeId: a.worktreeId,
        change: 'files',
      });
      const stale = await captured.promise;
      await read(session, {
        method: 'PUT',
        path: `/api/reviews/${a.reviewId}/seen`,
        body: { revision },
      });
      callbacks?.onNotice({
        type: 'worktree',
        projectId: session.projectId,
        worktreeId: a.worktreeId,
        change: 'reviewed',
      });
      expect(
        (await readClientAtom(subject.registry, readReview(aInput))).review
          ?.lastSeenRevision,
      ).toBe(revision);
      held.resolve(stale);
      await settle();
      expect(metadataReads()).toBe(beforeHeld + 2);
      expect(counts(b.reviewId)).toEqual(bReads);
      expect(counts(c.reviewId)).toEqual(cReads);
      const beforeRecovery = counts(c.reviewId).length;
      callbacks?.onReconnect();
      await expect
        .poll(() => counts(c.reviewId).length)
        .toBeGreaterThan(beforeRecovery);
      await settle();
      expect(counts(b.reviewId).length).toBeGreaterThan(bReads.length);
      const beforeInventory = counts(c.reviewId).length;
      callbacks?.onNotice({ type: 'inventory' });
      await expect
        .poll(() => counts(c.reviewId).length)
        .toBeGreaterThan(beforeInventory);
      await settle();
    } finally {
      held.resolve(Response.json({}));
      initialHeld.resolve(Response.json({}));
      for (const stop of stops) stop();
      subject.registry.dispose();
      await subject.close();
    }
  },
);
