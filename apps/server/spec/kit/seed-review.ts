import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readPublishedReviewResponseSchema } from '@porcelain/contracts/reviews';
import { readInventoryResponseSchema } from '@porcelain/contracts/projects';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Effect } from 'effect';
import { NodeServices } from '@effect/platform-node';
import { storageLayer } from '@porcelain/storage';
import { ReviewStore } from '@porcelain/reviews/ports';
import type {
  Review,
  ReviewLayer,
  ProofDraft,
  ProofFile,
  ReviewProof,
} from '@porcelain/reviews/models';

export type ReviewFixtureDraft = {
  expectedRevision: number;
  base?: string;
  reviewId?: string | undefined;
  timing?: Review['timing'];
  verdict: Review['verdict'];
  summaryHtml?: string | undefined;
  pullRequest?: string;
  diagram?: Review['diagram'];
  layers: readonly (Omit<ReviewLayer, 'fingerprint' | 'steps'> & {
    steps: readonly Omit<ReviewLayer['steps'][number], 'published'>[];
  })[];
  proof?: ProofDraft;
};
import { readBranchChangesResponseSchema } from '@porcelain/contracts/changes';
import { Schema } from 'effect';
import { publishedLayerFingerprint } from '@porcelain/reviews/rules';
import type { Session } from './session.ts';

export async function seedReview(session: Session, draft: ReviewFixtureDraft) {
  const git = async (...args: string[]) =>
    (
      await promisify(execFile)('git', ['-C', session.repository, ...args])
    ).stdout.trim();
  await session.read({
    method: 'POST',
    path: '/api/projects',
    body: { path: session.repository },
  });
  const inventory = Schema.decodeUnknownSync(readInventoryResponseSchema)(
    (await session.read({ method: 'GET', path: '/api/inventory' })).body,
  );
  const project = inventory.projects.find((project) =>
    project.worktrees.some((worktree) => worktree.path === session.repository),
  );
  const worktree = project?.worktrees.find(
    (worktree) => worktree.path === session.repository,
  );
  if (!project || !worktree)
    throw new Error('Review fixture checkout must be registered');
  const selected = {
    ...session,
    projectId: project.id,
    worktreeId: worktree.id,
  };
  const branch = Schema.decodeUnknownSync(readBranchChangesResponseSchema)(
    (
      await session.read({
        method: 'GET',
        path: `/api/worktrees/${selected.worktreeId}/branch-changes`,
        query: { base: draft.base ?? 'refs/heads/porcelain-fixture-base' },
      })
    ).body,
  );
  if (!branch.base || !branch.mergeBaseOid || !branch.head.branch)
    throw new Error('Review fixture requires a committed branch');
  const layers = await Promise.all(
    draft.layers.map(async (layer) => {
      const steps = await Promise.all(
        layer.steps.map(async (step) => ({
          ...step,
          published: (
            await readFile(join(session.repository, step.pointer.path), 'utf8')
          )
            .split('\n')
            .slice(step.pointer.startLine - 1, step.pointer.endLine),
        })),
      );
      return { ...layer, steps, fingerprint: publishedLayerFingerprint(steps) };
    }),
  );
  const commonDirectory = resolve(
    session.repository,
    await git('rev-parse', '--git-common-dir'),
  );
  const current = Schema.decodeUnknownSync(readPublishedReviewResponseSchema)(
    (
      await session.read({
        method: 'GET',
        path: `/api/worktrees/${selected.worktreeId}/review`,
      })
    ).body,
  ).review;
  const reviewId = draft.reviewId ?? current?.reviewId ?? randomUUID();
  const proofFiles: ProofFile[] = [];
  const assets: ReviewProof['assets'][number][] = [];
  for (const asset of draft.proof?.assets ?? []) {
    const id = randomUUID();
    if (asset.kind === 'link') assets.push({ ...asset, id });
    else {
      if (!asset.path) throw new Error('Stored proof fixture requires a path');
      const bytes = await readFile(join(session.repository, asset.path));
      const mediaType = 'image/png' as const;
      proofFiles.push({ id, mediaType, bytes });
      assets.push({
        id,
        kind: asset.kind,
        title: asset.title,
        layerId: asset.layerId,
        stepId: asset.stepId,
        optionId: asset.optionId,
        mediaType,
        byteLength: bytes.byteLength,
      });
    }
  }
  const revision = draft.expectedRevision + 1;
  const review = {
    reviewId,
    revision,
    projectId: selected.projectId,
    worktreeId: selected.worktreeId,
    commonDirectory,
    worktreePath: session.repository,
    worktreeName: 'Fixture',
    branch: branch.head.branch.replace(/^refs\/heads\//, ''),
    headOid: branch.head.oid,
    base: branch.base.ref,
    baseOid: branch.base.oid,
    mergeBaseOid: branch.mergeBaseOid,
    files: branch.files,
    notExplained: [],
    verdict: draft.verdict,
    layers,
    proof: {
      checks: draft.proof?.checks ?? [],
      assets,
      paths: (draft.proof?.assets ?? []).flatMap((asset) =>
        asset.kind !== 'link' && asset.path ? [asset.path] : [],
      ),
    },
    publishedAt: '2026-11-10T10:00:00.000Z',
    active: true,
    timing: draft.timing ?? 'decision',
    summaryHtml:
      draft.summaryHtml ?? '<!doctype html><html><body></body></html>',
    summaryToken: randomUUID(),
    summarySecret: randomUUID(),
    ...(draft.diagram ? { diagram: draft.diagram } : {}),
  };
  await git(
    'update-ref',
    `refs/porcelain/reviews/${reviewId}/${revision}`,
    branch.head.oid,
  );
  await Effect.runPromise(
    Effect.gen(function* () {
      const store = yield* ReviewStore;
      const prior = yield* store.readRecord({ reviewId });
      yield* store.save({
        ...review,
        proofFiles,
        expectedRevision: draft.expectedRevision,
        record: {
          reviewId,
          projectId: selected.projectId,
          commonDirectory,
          branch: review.branch,
          state: 'open',
          latestRevision: revision,
          lastSeenRevision: prior?.lastSeenRevision ?? 0,
          ...(draft.pullRequest ? { pullRequest: draft.pullRequest } : {}),
        },
      });
    }).pipe(
      Effect.provide(
        storageLayer(session.dataDirectory, {
          worktreeIdLength: 12,
          busyTimeoutMs: 5000,
        }),
      ),
      Effect.provide(NodeServices.layer),
    ),
  );
  const read = await session.read({
    method: 'GET',
    path: `/api/worktrees/${selected.worktreeId}/review`,
  });
  return {
    reviewId,
    revision,
    headOid: review.headOid,
    baseOid: review.baseOid,
    worktreeId: selected.worktreeId,
    ...Schema.decodeUnknownSync(
      Schema.toEncoded(readPublishedReviewResponseSchema),
    )(read.body),
  };
}
