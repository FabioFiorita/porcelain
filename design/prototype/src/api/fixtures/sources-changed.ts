/** Changed files in the porcelain rebuild worktree: HEAD content and working content. */
export type SourcePair = {
  path: string;
  old: string;
  next: string;
};

export const SOURCES: SourcePair[] = [
  {
    path: 'packages/contracts/src/review-layers.ts',
    old: `import { z } from 'zod';

export const layerSchema = z.object({
  id: z.string(),
  title: z.string(),
  files: z.array(z.string()),
});

export const layerSetSchema = z.object({
  worktreeId: z.string(),
  layers: z.array(layerSchema),
});

export type Layer = z.infer<typeof layerSchema>;
export type LayerSet = z.infer<typeof layerSetSchema>;
`,
    next: `import { z } from 'zod';

/**
 * A layer is the agent's own grouping of the change. The summary is markdown
 * so the handoff can explain itself; the reviewer reads it before any code.
 */
export const layerFileSchema = z.object({
  path: z.string(),
  note: z.string().optional(),
});

export const layerSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  files: z.array(layerFileSchema),
});

export const layerSetSchema = z.object({
  worktreeId: z.string(),
  contentFingerprint: z.string(),
  layers: z.array(layerSchema),
});

export type LayerFile = z.infer<typeof layerFileSchema>;
export type Layer = z.infer<typeof layerSchema>;
export type LayerSet = z.infer<typeof layerSetSchema>;
`,
  },
  {
    path: 'packages/contracts/src/comments.ts',
    old: `import { z } from 'zod';

export const anchorSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('file'), path: z.string() }),
  z.object({
    kind: z.literal('line'),
    path: z.string(),
    line: z.number().int().positive(),
  }),
]);

export const messageSchema = z.object({
  id: z.string(),
  body: z.string(),
});
`,
    next: `import { z } from 'zod';

export const anchorSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('file'), path: z.string() }),
  z.object({
    kind: z.literal('line'),
    path: z.string(),
    line: z.number().int().positive(),
    side: z.enum(['additions', 'deletions']),
    rangeLabel: z.string(),
  }),
  // A question about the grouping itself, not about any one line.
  z.object({ kind: z.literal('layer'), layerId: z.string() }),
]);

export const messageSchema = z.object({
  id: z.string(),
  author: z.enum(['reviewer', 'agent']),
  body: z.string(),
  createdAt: z.string().datetime(),
});

export const threadSchema = z.object({
  id: z.string(),
  anchor: anchorSchema,
  // The snippet travels with the thread so it still reads after a rebase.
  snippet: z.string(),
  status: z.enum(['open', 'resolved']),
  messages: z.array(messageSchema),
});
`,
  },
  {
    path: 'apps/server/src/db/schema/reviewed-files.ts',
    old: `import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const filePreferences = sqliteTable('file_preferences', {
  projectId: text('project_id').notNull(),
  path: text('path').notNull(),
  pinned: text('pinned'),
  hidden: text('hidden'),
});
`,
    next: `import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Reviewed is worktree-scoped, not project-scoped: the same path in two
 * worktrees is two different reviews. The fingerprint is the file content at
 * the moment the tick was set, so any later edit clears it automatically.
 */
export const reviewedFiles = sqliteTable(
  'reviewed_files',
  {
    worktreeId: text('worktree_id').notNull(),
    path: text('path').notNull(),
    contentFingerprint: text('content_fingerprint').notNull(),
    reviewedAt: text('reviewed_at').notNull(),
  },
  (table) => [index('reviewed_files_worktree_idx').on(table.worktreeId)],
);
`,
  },
  {
    path: 'apps/web/src/views/review/review-surface.tsx',
    old: `import { CodeView } from '@pierre/diffs/react';

export function ReviewSurface({ items }: { items: CodeViewItem[] }) {
  return <CodeView items={items} />;
}
`,
    next: `import type { CodeViewItem } from '@pierre/diffs';
import { CodeView, type CodeViewHandle } from '@pierre/diffs/react';
import { useRef } from 'react';

const options = {
  theme: { light: 'pierre-light', dark: 'pierre-dark' },
  stickyHeaders: true,
  enableLineSelection: true,
  enableGutterUtility: true,
} as const;

export function ReviewSurface({ items }: { items: CodeViewItem<Thread>[] }) {
  const viewer = useRef<CodeViewHandle<Thread, undefined>>(null);

  // Comments render inline, above the line they are about. They are the
  // point of the page, so they never get pushed to the bottom.
  return (
    <CodeView
      ref={viewer}
      items={items}
      options={options}
      renderAnnotation={(annotation) => (
        <ThreadCard thread={annotation.metadata} />
      )}
    />
  );
}
`,
  },
];
