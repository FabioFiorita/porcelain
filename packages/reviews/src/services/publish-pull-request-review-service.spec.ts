import { testClock } from '@porcelain/kernel/test-kit';
import { Cause, Clock, Deferred, Effect, Exit, Fiber, Semaphore } from 'effect';
import { describe, expect, it } from 'vite-plus/test';
import { DraftCommentPublishedError } from '../errors/draft-comment-published-error.ts';
import type { DraftCommentView } from '../models/draft-comment.ts';
import { DraftCommentStore } from '../ports/draft-comment-store.ts';
import {
  PullRequestReviewer,
  type PullRequestReviewer as Reviewer,
} from '../ports/pull-request-reviewer.ts';
import { InMemoryDraftCommentStore } from '../../spec/fakes/in-memory-draft-comment-store.ts';
import { openDraftRevision } from '../rules/draft-comments.ts';
import { EditDraftCommentService } from './edit-draft-comment-service.ts';
import { PublishPullRequestReviewService } from './publish-pull-request-review-service.ts';

const worktreeId = 'w'.repeat(32);
const HEAD = 'c'.repeat(40);
const target = { owner: 'acme', repo: 'notes', account: 'dev', number: 7 };
const PATCH = '@@ -0,0 +1,2 @@\n+export const a = 1;\n+export const b = 2;';

function stored(id: string, anchor: DraftCommentView['anchor']) {
  return {
    id,
    worktreeId,
    branch: 'feature/search',
    anchor,
    text: `draft ${id}`,
    headOid: HEAD,
    createdAt: '2026-11-25T10:00:00.000Z',
    updatedAt: '2026-11-25T10:00:00.000Z',
    publication: { status: 'draft' as const },
  };
}

async function setup(headOid = HEAD, beforePost = Effect.void) {
  const store = new InMemoryDraftCommentStore();
  const inline = stored('inline', {
    kind: 'lines',
    path: 'src/a.ts',
    side: 'additions',
    start: 2,
    end: 2,
    text: 'export const b = 2;',
  });
  const step = stored('step', { kind: 'step', title: 'Search' });
  await Effect.runPromise(store.insert(inline));
  await Effect.runPromise(store.insert(step));
  const posted: Parameters<Reviewer['post']>[0][] = [];
  const reviewer: Reviewer = {
    diff: () =>
      Effect.succeed({ headOid, files: [{ path: 'src/a.ts', patch: PATCH }] }),
    post: (input) =>
      beforePost.pipe(
        Effect.andThen(
          Effect.sync(() => {
            posted.push(input);
            return {
              url: 'https://github.com/acme/notes/pull/7#pullrequestreview-9',
            };
          }),
        ),
      ),
  };
  const service = Effect.runSync(
    PublishPullRequestReviewService.pipe(
      Effect.provide(PublishPullRequestReviewService.layer),
      Effect.provideService(DraftCommentStore, store),
      Effect.provideService(PullRequestReviewer, reviewer),
      Effect.provideService(
        Clock.Clock,
        await testClock('2026-11-25T12:00:00.000Z'),
      ),
    ),
  );
  const comments: DraftCommentView[] = [inline, step].map(
    ({ worktreeId: _w, branch: _b, ...comment }) => ({
      ...comment,
      outdated: false,
    }),
  );
  const preview = {
    pullRequest: target,
    headOid: HEAD,
    inlineIds: ['inline'],
    draftRevision: openDraftRevision(comments),
  };
  return { store, posted, service, comments, preview };
}

describe('PublishPullRequestReviewService', () => {
  it('posts one review with the confirmed text and marks every draft published', async () => {
    const { store, posted, service, comments, preview } = await setup();
    const result = await Effect.runPromise(
      service.execute({
        worktreeId,
        target,
        comments,
        confirmed: {
          ...preview,
          summary: 'Two notes.',
          bodies: { inline: 'Name this better.', step: 'Show no notes.' },
        },
      }),
    );
    expect(result.url).toBe(
      'https://github.com/acme/notes/pull/7#pullrequestreview-9',
    );
    expect(posted).toEqual([
      {
        ...target,
        commitId: HEAD,
        body: 'Two notes.\n\n**Walkthrough step “Search”**\n\nShow no notes.',
        comments: [
          {
            path: 'src/a.ts',
            side: 'RIGHT',
            line: 2,
            body: 'Name this better.',
          },
        ],
      },
    ]);
    expect(
      (
        await Effect.runPromise(
          store.list({ worktreeId, branch: 'feature/search' }),
        )
      ).map((comment) => comment.publication),
    ).toEqual([
      {
        status: 'published',
        url: 'https://github.com/acme/notes/pull/7#pullrequestreview-9',
        publishedAt: '2026-11-25T12:00:00.000Z',
      },
      {
        status: 'published',
        url: 'https://github.com/acme/notes/pull/7#pullrequestreview-9',
        publishedAt: '2026-11-25T12:00:00.000Z',
      },
    ]);
  });

  it('refuses an edit waiting behind publication and keeps the posted draft unchanged', async () => {
    const posting = Deferred.makeUnsafe<void>();
    const releasePost = Deferred.makeUnsafe<void>();
    const { store, posted, service, comments, preview } = await setup(
      HEAD,
      Deferred.succeed(posting, undefined).pipe(
        Effect.andThen(Deferred.await(releasePost)),
      ),
    );
    await Effect.runPromise(
      Effect.gen(function* () {
        const edit = yield* EditDraftCommentService.pipe(
          Effect.provide(EditDraftCommentService.layer),
          Effect.provideService(DraftCommentStore, store),
        );
        const writer = yield* Semaphore.make(1);
        const publish = yield* Effect.forkChild(
          writer.withPermit(
            service.execute({
              worktreeId,
              target,
              comments,
              confirmed: {
                ...preview,
                summary: '',
                bodies: { inline: 'draft inline', step: 'draft step' },
              },
            }),
          ),
          { startImmediately: true },
        );
        yield* Deferred.await(posting);
        const editRequested = Deferred.makeUnsafe<void>();
        const save = yield* Effect.forkChild(
          Deferred.succeed(editRequested, undefined).pipe(
            Effect.andThen(
              writer.withPermit(
                edit.execute({
                  worktreeId,
                  id: 'inline',
                  text: 'A later save',
                }),
              ),
            ),
          ),
          { startImmediately: true },
        );
        yield* Deferred.await(editRequested);
        yield* Deferred.succeed(releasePost, undefined);
        yield* Fiber.join(publish);
        const refused = yield* Fiber.await(save);
        expect(
          Exit.isFailure(refused) && Cause.squash(refused.cause),
        ).toBeInstanceOf(DraftCommentPublishedError);
        expect(yield* store.find({ worktreeId, id: 'inline' })).toMatchObject({
          text: 'draft inline',
          publication: { status: 'published' },
        });
        expect(posted).toHaveLength(1);
        expect(posted[0]?.comments[0]?.body).toBe('draft inline');
      }),
    );
  });

  it('refuses to post when the pull request moved after the preview', async () => {
    const { store, posted, service, comments, preview } = await setup(
      'd'.repeat(40),
    );
    const exit = await Effect.runPromiseExit(
      service.execute({
        worktreeId,
        target,
        comments,
        confirmed: {
          ...preview,
          summary: '',
          bodies: { inline: 'x', step: 'y' },
        },
      }),
    );
    expect(Exit.isFailure(exit)).toBe(true);
    expect(JSON.stringify(exit)).toContain('ReviewChangedError');
    expect(posted).toEqual([]);
    expect(
      (
        await Effect.runPromise(
          store.list({ worktreeId, branch: 'feature/search' }),
        )
      ).every((comment) => comment.publication.status === 'draft'),
    ).toBe(true);
  });

  it('refuses a confirmation that adds a comment the developer did not write', async () => {
    const { posted, service, comments, preview } = await setup();
    const exit = await Effect.runPromiseExit(
      service.execute({
        worktreeId,
        target,
        comments,
        confirmed: {
          ...preview,
          summary: '',
          bodies: { inline: 'x', step: 'y', invented: 'z' },
        },
      }),
    );
    expect(JSON.stringify(exit)).toContain('ReviewChangedError');
    expect(posted).toEqual([]);
  });

  it('refuses with a plain message when the branch has no open pull request, posting nothing', async () => {
    const { posted, service, comments, preview } = await setup();
    const exit = await Effect.runPromiseExit(
      service.execute({
        worktreeId,
        target: { unavailable: 'no-pull-request' },
        comments,
        confirmed: {
          ...preview,
          summary: '',
          bodies: { inline: 'x', step: 'y' },
        },
      }),
    );
    expect(JSON.stringify(exit)).toContain('PullRequestReviewFailedError');
    expect(JSON.stringify(exit)).toContain(
      'This branch has no open pull request.',
    );
    expect(posted).toEqual([]);
  });
});
