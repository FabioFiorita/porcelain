import { Schema } from 'effect';
import { readInventoryResponseSchema } from '@porcelain/contracts/projects';
import { readPublishedReviewResponseSchema } from '@porcelain/contracts/reviews';
import { randomUUID } from 'node:crypto';
import { commitReviewFixture, sampleReview } from './requests.ts';
import { seedReview } from './seed-review.ts';
import { seedArchitectureSample } from './architecture-sample.ts';
import { seedStressSample } from './stress-sample.ts';
import type { AgentAction, Session } from './session.ts';

export async function agentActs(
  source: Session,
  action: AgentAction,
): Promise<unknown> {
  const session = source;
  if (action.kind === 'publish-architecture')
    return seedArchitectureSample(session, action.questions);
  if (action.kind === 'seed') return seedStressSample(session, action.variant);
  const inventory = Schema.decodeUnknownSync(readInventoryResponseSchema)(
    (await session.read({ method: 'GET', path: '/api/inventory' })).body,
  );
  const project = inventory.projects.find((entry) =>
    entry.worktrees.some((worktree) => worktree.path === session.repository),
  );
  const worktree = project?.worktrees.find(
    (worktree) => worktree.path === session.repository,
  );
  if (!project || !worktree)
    throw new Error('Fixture checkout must be registered');
  session.projectId = project.id;
  session.worktreeId = worktree.id;
  if (action.kind === 'publish-review' || action.kind === 'publish-proof') {
    await commitReviewFixture(session);
    const current = await session.read({
      method: 'GET',
      path: `/api/worktrees/${session.worktreeId}/review`,
    });
    const previous = Schema.decodeUnknownSync(
      readPublishedReviewResponseSchema,
    )(current.body).review;
    const layerId = randomUUID();
    if (action.kind === 'publish-proof')
      await session.writeFile(
        'proof-screenshot.png',
        Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          'base64',
        ),
      );
    const seeded = await seedReview(session, {
      ...sampleReview(session, previous?.revision ?? 0, layerId, randomUUID(), {
        title: action.title,
        kind: action.kind === 'publish-review' ? action.step : 'changed',
      }),
      ...(action.kind === 'publish-proof'
        ? {
            proof: {
              checks: action.checks.map((check) => ({ ...check, layerId })),
              assets: [
                {
                  kind: 'image' as const,
                  title: action.screenshot,
                  path: 'proof-screenshot.png',
                },
              ],
            },
          }
        : {}),
      ...(previous ? { reviewId: previous.reviewId } : {}),
      ...(action.kind === 'publish-review' && action.summaryHtml !== undefined
        ? { summaryHtml: action.summaryHtml }
        : {}),
    });
    if (action.kind === 'publish-proof')
      await session.remove('proof-screenshot.png');
    return seeded;
  }
  if (action.kind === 'edit-file')
    return (
      await session.read({
        method: 'POST',
        path: `/api/worktrees/${session.worktreeId}/files`,
        body: action.edit,
      })
    ).body;
  if (action.kind === 'reply')
    return (
      await session.read({
        method: 'POST',
        path: action.reviewId
          ? `/api/reviews/${action.reviewId}/comments/${action.threadId}/replies`
          : `/api/worktrees/${session.worktreeId}/comments/${action.threadId}/replies`,
        body: { body: action.body },
      })
    ).body;
  return (
    await session.read({
      method: 'POST',
      path: `/api/worktrees/${session.worktreeId}/comments`,
      body: {
        threadId: randomUUID(),
        ...(action.thread ?? {
          anchor: { kind: 'file', filePath: action.path },
        }),
        body: action.body,
      },
    })
  ).body;
}
