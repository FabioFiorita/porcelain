import { check, layerLink, SUMMARY_STYLE } from './summary-style';
import type { ReviewSeed } from './types';

/**
 * The porcelain rebuild worktree's review: what the agent published with
 * `publish_review`. Its steps point into the files below and in sources-changed.ts
 * by text (`find`), so the mock can re-find them after an edit.
 */

export const LAYER_IDS = {
  saveTick: 'c1000000-0000-4000-8000-000000000001',
  staleTick: 'c1000000-0000-4000-8000-000000000002',
  commentAuthors: 'c1000000-0000-4000-8000-000000000003',
} as const;

/** New files the agent added in this worktree (head is null). */
export const REBUILD_NEW_FILES: Record<string, string> = {
  'apps/web/src/query/reviewed.ts': `import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ReviewScope } from '../api/api';
import { queryKeys } from './keys';
import { useWorkspaceContext } from './workspace-provider';

type SetReviewed = { path: string; reviewed: boolean; contentFingerprint: string };

/**
 * Ticks a file for this worktree only. The fingerprint is the diff the
 * reviewer saw; the server keeps it and reports the tick stale later.
 */
export function useSetReviewed(scope: ReviewScope) {
  const { api, environmentId } = useWorkspaceContext();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: SetReviewed) => api.reviewed.set({ ...scope, input }),
    onSuccess: (marks) => {
      client.setQueryData(queryKeys.reviewed(environmentId, scope), marks);
    },
  });
}
`,
  'apps/server/src/http/routes/reviewed.ts': `import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ReadReviewed } from '../../use-cases/read-reviewed.ts';
import type { SetReviewed } from '../../use-cases/set-reviewed.ts';

const params = z.object({ worktreeId: z.string().uuid() });
const body = z.object({
  path: z.string().min(1),
  reviewed: z.boolean(),
  contentFingerprint: z.string().min(1),
});

export function registerReviewedRoutes(
  app: FastifyInstance,
  useCases: { read: ReadReviewed; set: SetReviewed },
) {
  app.get('/worktrees/:worktreeId/reviewed', async (request) => {
    const { worktreeId } = params.parse(request.params);
    return { worktreeId, marks: await useCases.read.execute(worktreeId) };
  });

  app.put('/worktrees/:worktreeId/reviewed', async (request) => {
    const { worktreeId } = params.parse(request.params);
    const input = body.parse(request.body);
    await useCases.set.execute(worktreeId, input);
    return { worktreeId, marks: await useCases.read.execute(worktreeId) };
  });
}
`,
  'apps/server/src/use-cases/set-reviewed.ts': `import type { ReviewedStore } from '../repositories/reviewed-store.ts';

type Input = { path: string; reviewed: boolean; contentFingerprint: string };

/**
 * One tick for one path in one worktree. Unticking deletes the row; ticking
 * again replaces it, so the stored fingerprint is always the latest one seen.
 */
export class SetReviewed {
  constructor(
    private readonly store: ReviewedStore,
    private readonly now: () => Date,
  ) {}

  async execute(worktreeId: string, input: Input): Promise<void> {
    if (!input.reviewed) {
      await this.store.remove(worktreeId, input.path);
      return;
    }
    await this.store.save({
      worktreeId,
      path: input.path,
      contentFingerprint: input.contentFingerprint,
      reviewedAt: this.now().toISOString(),
    });
  }
}
`,
  'apps/server/src/use-cases/read-reviewed.ts': `import { diffFingerprint } from '@porcelain/git/diff-fingerprint';
import type { ReviewedStore } from '../repositories/reviewed-store.ts';
import type { WorktreeGit } from './interfaces/worktree-git.ts';

export type ReviewedMark = {
  path: string;
  contentFingerprint: string;
  reviewedAt: string;
  stale: boolean;
};

/**
 * Every tick of a worktree, each compared with the diff as it is now. A tick
 * whose fingerprint no longer matches is stale: the reviewer saw other code.
 */
export class ReadReviewed {
  constructor(
    private readonly store: ReviewedStore,
    private readonly git: WorktreeGit,
  ) {}

  async execute(worktreeId: string): Promise<ReviewedMark[]> {
    const rows = await this.store.list(worktreeId);
    const patches = await this.git.patches(worktreeId, rows.map((row) => row.path));
    return rows.map((row) => ({
      ...row,
      stale: diffFingerprint(patches.get(row.path) ?? '') !== row.contentFingerprint,
    }));
  }
}
`,
  'packages/git/src/diff-fingerprint.ts': `import { createHash } from 'node:crypto';

/**
 * A short, stable name for one file's diff. Whitespace at line ends is
 * ignored so an editor trimming spaces does not clear a reviewer's tick.
 */
export function diffFingerprint(patch: string): string {
  const normalized = patch
    .split('\\n')
    .filter((line) => !line.startsWith('index '))
    .map((line) => line.trimEnd())
    .join('\\n');
  return createHash('sha256').update(normalized).digest('hex').slice(0, 16);
}
`,
  'apps/web/src/views/review/reviewed-badge.tsx': `import { RotateCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

/** A tick the agent invalidated: the code changed after the reviewer saw it. */
export function ReviewedBadge({ stale }: { stale: boolean }) {
  if (!stale) return null;
  return (
    <Badge variant="outline" className="gap-1 text-amber-600">
      <RotateCw className="size-3" />
      Changed since reviewed
    </Badge>
  );
}
`,
};

/**
 * The agent's summary page, like a Claude artifact. Porcelain serves it from its
 * own link and injects its fonts and theme tokens; `#layer-N` links open that layer.
 */
const SUMMARY_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Reviewed state now belongs to the worktree</title>
${SUMMARY_STYLE}
</head>
<body>
<main>
  <div class="eyebrow">
    <span class="pill ok">Ready for review</span>
    <span class="pill"><code>codex/porcelain-rebuild</code></span>
    <span class="pill">3 layers</span>
  </div>
  <h1>Reviewed state now belongs to the worktree</h1>
  <p class="lede">Ticking a file used to mean little: the tick leaked into every worktree of the project and stayed on after the file changed. Now each worktree keeps its own ticks, and a tick clears itself the moment the code you saw is different. Comments also record who wrote them.</p>

  <div class="stats">
    <div class="stat"><b>3</b><span>behaviours changed, one layer each</span></div>
    <div class="stat"><b>48</b><span>contract and server specs passing</span></div>
    <div class="stat warn"><b>1</b><span>open question before merge</span></div>
  </div>

  <h2>Read in this order</h2>
  <div class="layers">
    ${layerLink(1, 'Ticking a file saves a mark for this worktree', ['Web hook', 'Route', 'Use case', 'Storage'])}
    ${layerLink(2, 'An edit after review clears the tick', ['Route', 'Use case', 'Git', 'Web'])}
    ${layerLink(3, 'Comments keep their side and their author', ['Contract', 'Server', 'Web'])}
  </div>

  <h2>What was wrong, and what changed</h2>
  <div class="change">
    <h3>A tick in one worktree ticked it everywhere <span class="tag fixed">Fixed</span></h3>
    <div class="sides">
      <div class="side before"><span class="label">Before</span>Reviewed flags lived on the project. Reviewing <code>main</code> marked the same path reviewed on every branch, even where the code was different.</div>
      <div class="side after"><span class="label">After</span>Ticks live on the worktree, so each checkout starts clean.</div>
    </div>
  </div>
  <div class="change">
    <h3>Editing a reviewed file kept the tick <span class="tag fixed">Fixed</span></h3>
    <div class="sides">
      <div class="side before"><span class="label">Before</span>Nothing noticed when the agent changed a file after you had ticked it.</div>
      <div class="side after"><span class="label">After</span>The tick stores a fingerprint of the diff you saw. When the diff moves on, the file shows “Changed since reviewed”.</div>
    </div>
  </div>
  <div class="change">
    <h3>Old comments have no author <span class="tag later">Needs a backfill</span></h3>
    <p class="plain">Comments stored before this change don't say who wrote them. They should be marked as yours before the new schema reads them.</p>
  </div>
  <div class="change">
    <h3>Existing ticks are not migrated <span class="tag open">Open</span></h3>
    <p class="plain">Carrying old project-wide ticks into every worktree would bring the bug back, so they are left behind for now. Say if you want them dropped instead.</p>
  </div>

  <h2>How it was checked</h2>
  <div class="checks">
    ${check(true, 'Contracts and server specs', '48 passed')}
    ${check(true, 'Tick a file, then edit it', 'the tick clears')}
    ${check(true, 'Same path in two worktrees', 'two separate ticks')}
    ${check(false, 'Migrating old ticks', 'not done')}
  </div>
  <details>
    <summary>Commands I ran</summary>
    <pre>pnpm vitest run packages/contracts apps/server/src/use-cases
pnpm dev   # ticked review-surface.tsx, edited it, saw the tick clear</pre>
  </details>
</main>
</body>
</html>
`;

export const REBUILD_REVIEW: ReviewSeed = {
  summaryHtml: SUMMARY_HTML,
  minutesAgo: 6,
  diagram: {
    before: {
      lanes: ['Web', 'Server', 'Storage'],
      boxes: [
        { id: 'tick', lane: 0, kind: 'actor', label: 'Tick a file' },
        {
          id: 'prefs',
          lane: 1,
          kind: 'component',
          label: 'PUT file-preferences',
          detail: 'A project-wide flag',
        },
        {
          id: 'table',
          lane: 2,
          kind: 'storage',
          label: 'file_preferences',
          problem:
            'One tick shared by every worktree of the project, and nothing clears it when the file changes.',
        },
      ],
      arrows: [
        { from: 'tick', to: 'prefs' },
        { from: 'prefs', to: 'table' },
      ],
    },
    after: {
      lanes: ['Web', 'Server', 'Git', 'Storage'],
      boxes: [
        {
          id: 'tick',
          lane: 0,
          kind: 'actor',
          label: 'Tick a file',
          detail: 'Sends the fingerprint of the diff it showed',
          change: 'changed',
          layerId: LAYER_IDS.saveTick,
        },
        {
          id: 'badge',
          lane: 0,
          kind: 'component',
          label: 'Changed since reviewed',
          detail: 'Shown when a tick goes stale',
          change: 'new',
          layerId: LAYER_IDS.staleTick,
        },
        {
          id: 'put',
          lane: 1,
          kind: 'component',
          label: 'PUT /worktrees/:id/reviewed',
          change: 'new',
          layerId: LAYER_IDS.saveTick,
        },
        {
          id: 'set',
          lane: 1,
          kind: 'component',
          label: 'SetReviewed',
          detail: 'One row per path per worktree',
          change: 'new',
          layerId: LAYER_IDS.saveTick,
        },
        {
          id: 'read',
          lane: 1,
          kind: 'component',
          label: 'ReadReviewed',
          detail: 'Compares each tick with the diff now',
          change: 'new',
          layerId: LAYER_IDS.staleTick,
        },
        {
          id: 'fingerprint',
          lane: 2,
          kind: 'component',
          label: 'diffFingerprint',
          detail: 'Ignores trailing whitespace',
          change: 'new',
          layerId: LAYER_IDS.staleTick,
        },
        {
          id: 'table',
          lane: 3,
          kind: 'storage',
          label: 'reviewed_files',
          detail: 'Per worktree, with the fingerprint seen',
          change: 'new',
          layerId: LAYER_IDS.saveTick,
        },
        {
          id: 'prefs',
          lane: 3,
          kind: 'storage',
          label: 'file_preferences',
          detail: 'Keeps only hidden paths',
          change: 'changed',
        },
      ],
      arrows: [
        { from: 'tick', to: 'put' },
        { from: 'put', to: 'set' },
        { from: 'set', to: 'table' },
        { from: 'read', to: 'table', label: 'ticks' },
        { from: 'read', to: 'fingerprint', label: 'diff now' },
        { from: 'badge', to: 'read', label: 'stale?', dashed: true },
      ],
    },
  },
  layers: [
    {
      id: LAYER_IDS.saveTick,
      title: 'Ticking a file saves a mark for this worktree',
      summary:
        'From the click to the row: the tick carries the fingerprint of the diff you saw and lands in a table keyed by worktree.',
      lanes: ['Web hook', 'Route', 'Use case', 'Storage'],
      steps: [
        {
          id: 'c1-s1',
          lane: 0,
          title: 'useSetReviewed',
          text: 'Sends the path, the tick and the **fingerprint of the diff on screen**, then puts the server’s answer straight into the cache.',
          kind: 'changed',
          path: 'apps/web/src/query/reviewed.ts',
          find: 'type SetReviewed = ',
          lines: 16,
          symbol: 'useSetReviewed',
        },
        {
          id: 'c1-s2',
          lane: 1,
          title: 'PUT /worktrees/:worktreeId/reviewed',
          text: 'Validates the body and answers with every mark of the worktree, so the client never has to read them again.',
          kind: 'changed',
          path: 'apps/server/src/http/routes/reviewed.ts',
          find: "app.put('/worktrees/:worktreeId/reviewed'",
          lines: 6,
        },
        {
          id: 'c1-s3',
          lane: 2,
          title: 'SetReviewed.execute',
          text: 'Unticking deletes the row; ticking replaces it, so the stored fingerprint is always the latest one seen.',
          kind: 'changed',
          path: 'apps/server/src/use-cases/set-reviewed.ts',
          find: 'export class SetReviewed',
          lines: 19,
          symbol: 'SetReviewed.execute',
        },
        {
          id: 'c1-s4',
          lane: 3,
          title: 'reviewed_files',
          text: 'The new table: keyed by **worktree** and path, with the fingerprint and when it was ticked.',
          kind: 'changed',
          path: 'apps/server/src/db/schema/reviewed-files.ts',
          find: 'export const reviewedFiles = sqliteTable(',
          lines: 10,
          symbol: 'reviewedFiles',
        },
      ],
    },
    {
      id: LAYER_IDS.staleTick,
      title: 'An edit after review clears the tick',
      summary:
        'Reading the marks compares each stored fingerprint with the diff as it is now; a mismatch shows as "Changed since reviewed".',
      lanes: ['Route', 'Use case', 'Git', 'Web'],
      steps: [
        {
          id: 'c2-s1',
          lane: 0,
          title: 'GET /worktrees/:worktreeId/reviewed',
          text: 'Every read goes through the stale check; nothing is cached between reads.',
          kind: 'changed',
          path: 'apps/server/src/http/routes/reviewed.ts',
          find: "app.get('/worktrees/:worktreeId/reviewed'",
          lines: 4,
        },
        {
          id: 'c2-s2',
          lane: 1,
          title: 'ReadReviewed.execute',
          text: 'Reads the rows, asks Git for the current patch of just those paths, and marks a row stale when the fingerprints differ.',
          kind: 'changed',
          path: 'apps/server/src/use-cases/read-reviewed.ts',
          find: 'export class ReadReviewed',
          lines: 15,
          symbol: 'ReadReviewed.execute',
        },
        {
          id: 'c2-s3',
          lane: 2,
          title: 'diffFingerprint',
          text: 'Hashes the patch without its `index` line and trailing whitespace, so an editor trimming spaces does not clear a tick.',
          kind: 'changed',
          path: 'packages/git/src/diff-fingerprint.ts',
          find: 'export function diffFingerprint',
          lines: 8,
          symbol: 'diffFingerprint',
        },
        {
          id: 'c2-s4',
          lane: 3,
          title: 'ReviewedBadge',
          text: 'What the reviewer sees on a stale file.',
          kind: 'changed',
          path: 'apps/web/src/views/review/reviewed-badge.tsx',
          find: 'export function ReviewedBadge',
          lines: 9,
          symbol: 'ReviewedBadge',
        },
      ],
    },
    {
      id: LAYER_IDS.commentAuthors,
      title: 'Comments keep their side and their author',
      summary:
        'A line anchor records which side of the diff it is on, every message says who wrote it, and threads render under their lines.',
      lanes: ['Contract', 'Server', 'Web'],
      steps: [
        {
          id: 'c3-s1',
          lane: 0,
          title: 'anchorSchema',
          text: 'A line anchor now carries its **side**, so a comment on a deleted line is not read as the added line with the same number.',
          kind: 'changed',
          path: 'packages/contracts/src/comments.ts',
          find: 'export const anchorSchema',
          lines: 12,
          symbol: 'anchorSchema',
        },
        {
          id: 'c3-s2',
          lane: 0,
          title: 'messageSchema',
          text: 'Every message has an `author` and a time. There is no default, so stored threads need a backfill first.',
          kind: 'changed',
          path: 'packages/contracts/src/comments.ts',
          find: 'export const messageSchema',
          lines: 6,
          symbol: 'messageSchema',
        },
        {
          id: 'c3-s3',
          lane: 1,
          title: 'registerCommentRoutes',
          text: 'Unchanged, shown for context: the routes already parse threads with the contract, so the new fields flow through.',
          kind: 'context',
          path: 'apps/server/src/http/routes/comments.ts',
          find: 'export async function registerCommentRoutes',
          lines: 11,
          symbol: 'registerCommentRoutes',
        },
        {
          id: 'c3-s4',
          lane: 2,
          title: 'ReviewSurface',
          text: 'Threads render inline, under the lines they are about, through Pierre’s annotation slot.',
          kind: 'changed',
          path: 'apps/web/src/views/review/review-surface.tsx',
          find: 'export function ReviewSurface',
          lines: 16,
          symbol: 'ReviewSurface',
        },
      ],
    },
  ],
};
