/** Files the porcelain rebuild handoff did not touch. */
export const FILE_CONTENTS: Record<string, string> = {
  '.env.example': `# Copy to .env and fill in.
PORCELAIN_API_TARGET=http://127.0.0.1:4180
PORCELAIN_PLAYGROUND_BRIDGE=0
`,
  '.env': `PORCELAIN_API_TARGET=http://127.0.0.1:4180
PORCELAIN_PLAYGROUND_BRIDGE=1
PORCELAIN_PLAYGROUND_TOKEN_FILE=.playgrounds/token
`,
  'apps/server/src/app.ts': `import Fastify from 'fastify';
import { registerCommentRoutes } from './http/routes/comments';
import { registerLayerRoutes } from './http/routes/layers';

export async function buildApp() {
  const app = Fastify({ logger: true });

  await registerLayerRoutes(app);
  await registerCommentRoutes(app);

  return app;
}
`,
  'apps/server/src/db/schema/review-layer-sets.ts': `import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const reviewLayerSets = sqliteTable('review_layer_sets', {
  worktreeId: text('worktree_id').primaryKey(),
  contentFingerprint: text('content_fingerprint').notNull(),
  layers: text('layers', { mode: 'json' }).notNull(),
  updatedAt: text('updated_at').notNull(),
});
`,
  'apps/server/src/http/routes/comments.ts': `import type { FastifyInstance } from 'fastify';
import { threadSchema } from '@porcelain/contracts/comments';

export async function registerCommentRoutes(app: FastifyInstance) {
  app.get('/worktrees/:worktreeId/threads', async (request) => {
    const { worktreeId } = request.params as { worktreeId: string };
    return app.db.threads.listForWorktree(worktreeId);
  });

  app.post('/worktrees/:worktreeId/threads', async (request) => {
    const thread = threadSchema.parse(request.body);
    return app.db.threads.insert(thread);
  });
}
`,
  'apps/server/src/http/routes/layers.ts': `import type { FastifyInstance } from 'fastify';

export async function registerLayerRoutes(app: FastifyInstance) {
  app.get('/worktrees/:worktreeId/layers', async (request) => {
    const { worktreeId } = request.params as { worktreeId: string };
    const set = await app.db.layerSets.find(worktreeId);
    // An empty set is a valid answer: nothing was handed off yet.
    return set ?? { worktreeId, layers: [] };
  });
}
`,
  'apps/web/src/main.tsx': `import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app';
import './app.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
`,
  'apps/web/src/routes/router.tsx': `import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { z } from 'zod';
import { ConnectedWorkspace } from '../views/workspace/connected-workspace';

const rootRoute = createRootRoute();

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: z.object({
    worktree: z.string().optional(),
    surface: z.enum(['review', 'files', 'history']).optional(),
    entry: z.string().optional(),
  }),
  component: ConnectedWorkspace,
});

export const router = createRouter({ routeTree: rootRoute.addChildren([homeRoute]) });
`,
  'apps/web/src/views/review/review-sidebar.tsx': `import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Surface = 'review' | 'files' | 'history';

export function ReviewSidebar({
  surface,
  onSurface,
}: {
  surface: Surface;
  onSurface: (surface: Surface) => void;
}) {
  return (
    <Tabs value={surface} onValueChange={(value) => onSurface(value as Surface)}>
      <TabsList className="w-full">
        <TabsTrigger value="review">Review</TabsTrigger>
        <TabsTrigger value="files">Files</TabsTrigger>
        <TabsTrigger value="history">History</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
`,
  'apps/web/src/views/workspace/connected-workspace.tsx': `import { useSearch } from '@tanstack/react-router';
import { useWorktreeQuery } from '@/queries/worktrees';
import { ReviewWorkspace } from '../review/review-workspace';

export function ConnectedWorkspace() {
  const { worktree } = useSearch({ from: '/' });
  const query = useWorktreeQuery(worktree);

  if (query.isPending) return null;
  if (query.isError) return <p role="alert">{query.error.message}</p>;

  return <ReviewWorkspace worktree={query.data} />;
}
`,
  'packages/git/src/worktrees.ts': `import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

export type WorktreeEntry = { path: string; branch: string | null; head: string };

export async function listWorktrees(repository: string): Promise<WorktreeEntry[]> {
  const { stdout } = await run('git', ['worktree', 'list', '--porcelain'], { cwd: repository });

  return stdout
    .trim()
    .split('\\n\\n')
    .map((block) => {
      const fields = new Map(block.split('\\n').map((line) => {
        const [key, ...rest] = line.split(' ');
        return [key, rest.join(' ')] as const;
      }));
      return {
        path: fields.get('worktree') ?? '',
        head: fields.get('HEAD') ?? '',
        branch: fields.get('branch')?.replace('refs/heads/', '') ?? null,
      };
    });
}
`,
  'docs/product.md': `# Product scope

Porcelain helps a developer understand and review code produced by agents
running in other tools. Scope is intentional; there is no requirement to
preserve the previous application's features.

## Review workspace

A persistent worktree navigator combines projects and worktrees. Selecting a
worktree establishes context for Files, Changes, History, comments and
artifacts.

Changes presents diffs in agent-authored review layers with explicit group and
file order. Unassigned changes remain visible.
`,
  'docs/architecture.md': `# Architecture

- \`apps/server\` — Fastify, Drizzle and SQLite. Owns repositories, worktrees,
  review layers and comment threads.
- \`apps/web\` — React 19 with TanStack Router and Query.
- \`packages/contracts\` — Zod schemas shared by both sides.
- \`packages/git\` — the only code that shells out to git.

Routes own navigation, views own rendering and local state, query hooks own server
state, domain modules own pure rules, API adapters own transport.
`,
  'AGENTS.md': `# Agent guidance

- Tests and development fixtures use isolated state, never the installed
  \`~/.porcelain\`, real credentials or work projects.
- Stop only processes you started.
- Do not push, publish or open a pull request without explicit authorisation.
`,
  'README.md': `# Porcelain

![Porcelain](apps/web/public/logo.png)

A code-review workspace that sits beside your coding agents.

\`\`\`bash
pnpm install
pnpm dev:web
\`\`\`
`,
};
