import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

interface Action {
  id: string
  title: string
  command: string
  order: number
  createdAt: number
}

// The agent-channel content behind the marketing screenshots: the published Review,
// the project board, the human's review comments, and loop evidence — written to the
// same on-disk channels the porcelain CLI writes (keyed by absolute repo path), so
// every seeded surface renders exactly as a real agent hand-off would.
// Shapes mirror src/cli/*-file.ts (re-validated by the app's zod on read).

interface ReviewFile {
  path: string
  source?: 'changed' | 'context' | 'shipped'
  note?: string
  layer?: string
}

interface ReviewSection {
  title: string
  prose: string
  diagram?: string
  anchors: { path: string; startLine?: number; endLine?: number }[]
}

interface ReviewSet {
  name: string
  thesis?: string
  files: ReviewFile[]
  sections: ReviewSection[]
}

interface BoardCard {
  id: string
  title: string
  body?: string
  status: 'todo' | 'doing' | 'done'
  order: number
  createdAt: number
}

interface Comment {
  id: string
  path: string
  startLine?: number
  endLine?: number
  anchorText?: string
  body: string
  resolved: boolean
  createdAt: number
}

// A dark, self-contained flow diagram (inline SVG) — the agent renders its own
// mermaid→SVG; here we hand-draw a small Page → Hook → Route → Service → DB pipeline.
const FLOW_DIAGRAM = `<svg viewBox="0 0 720 120" xmlns="http://www.w3.org/2000/svg" font-family="ui-sans-serif, system-ui, sans-serif">
  <defs>
    <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L6,3 L0,6 Z" fill="#64748b" />
    </marker>
  </defs>
  ${['OrdersPage', 'useOrders', 'orders.route', 'orders.service', 'schema.prisma']
    .map((label, i) => {
      const x = 12 + i * 142
      return `<g>
    <rect x="${x}" y="40" width="118" height="40" rx="8" fill="#1e293b" stroke="#334155" />
    <text x="${x + 59}" y="65" text-anchor="middle" fill="#e2e8f0" font-size="13">${label}</text>
  </g>${
    i < 4
      ? `<line x1="${x + 118}" y1="60" x2="${x + 142}" y2="60" stroke="#64748b" stroke-width="1.5" marker-end="url(#arrow)" />`
      : ''
  }`
    })
    .join('\n  ')}
  <text x="360" y="24" text-anchor="middle" fill="#94a3b8" font-size="12">status flows down every layer</text>
</svg>`

const THESIS =
  'Orders can now be filtered by fulfilment status. The new `status` param is threaded ' +
  "end-to-end — from the page's dropdown, through the data hook and the HTTP route, into " +
  'the service query and the Prisma model — with a single shared `OrderStatus` vocabulary ' +
  'so the UI, the API, and the database can never drift out of sync.'

export const DEMO_REVIEW_SET: ReviewSet = {
  name: 'Filter orders by status',
  thesis: THESIS,
  files: [
    { path: 'src/pages/OrdersPage.tsx', source: 'changed', layer: 'Pages' },
    {
      path: 'src/components/OrderTable.tsx',
      source: 'changed',
      layer: 'Components',
      note: 'New presentational table; the status badge tone maps 1:1 to OrderStatus.',
    },
    { path: 'src/hooks/useOrders.ts', source: 'changed', layer: 'Hooks' },
    { path: 'src/routes/orders.route.ts', source: 'changed', layer: 'Routes' },
    {
      path: 'src/services/orders.service.ts',
      source: 'changed',
      layer: 'Services',
      note: 'The where-clause is only added when a status is supplied — no status means all orders.',
    },
    { path: 'src/types/order-status.ts', source: 'changed', layer: 'Services' },
    { path: 'prisma/schema.prisma', source: 'changed', layer: 'Data' },
    {
      path: 'src/lib/prisma.ts',
      source: 'context',
      layer: 'Data',
      note: 'Unchanged, shown for context — the single Prisma client the service uses.',
    },
  ],
  sections: [
    {
      title: 'Thread the filter from the screen',
      prose:
        'The page owns the selected status and hands it to `useOrders`. A shared ' +
        '`ORDER_STATUSES` list drives the dropdown, so adding a status is a one-line change ' +
        'here. Results render through the new `OrderTable`, which colours each status badge.',
      diagram: FLOW_DIAGRAM,
      anchors: [{ path: 'src/pages/OrdersPage.tsx' }, { path: 'src/components/OrderTable.tsx' }],
    },
    {
      title: 'Carry it across the API seam',
      prose:
        'The hook appends `status` to the query string only when one is set, keeping the ' +
        '“all orders” request byte-identical to before. The route parses the untrusted ' +
        'query value through `parseStatus`, so an unknown status can never reach the service.',
      anchors: [{ path: 'src/hooks/useOrders.ts' }, { path: 'src/routes/orders.route.ts' }],
    },
    {
      title: 'Filter at the data layer',
      prose:
        'The service adds a `where: { status }` clause only when a status is present, and the ' +
        'Prisma model gains a `status` column backed by the same `OrderStatus` enum. One ' +
        'vocabulary, from the `<select>` down to the database.',
      anchors: [{ path: 'src/services/orders.service.ts' }, { path: 'prisma/schema.prisma' }],
    },
  ],
}

const T0 = Date.UTC(2024, 4, 2, 9, 15, 0)

export const DEMO_BOARD: BoardCard[] = [
  {
    id: 'card-scaffold',
    title: 'Scaffold the orders module',
    body: 'List view, single-page fetch, Prisma model.',
    status: 'done',
    order: 1,
    createdAt: T0,
  },
  {
    id: 'card-paginate',
    title: 'Paginate the orders list',
    body: 'Page-size 20, newest first.',
    status: 'done',
    order: 2,
    createdAt: T0 + 1000,
  },
  {
    id: 'card-filter',
    title: 'Filter orders by status',
    body: 'Thread a status param from the page down to the query. Shared OrderStatus enum.',
    status: 'doing',
    order: 3,
    createdAt: T0 + 2000,
  },
  {
    id: 'card-csv',
    title: 'Export the current view as CSV',
    body: 'Respect the active status filter and page.',
    status: 'todo',
    order: 4,
    createdAt: T0 + 3000,
  },
  {
    id: 'card-daterange',
    title: 'Add a date-range filter',
    body: 'From/to on createdAt, alongside the status filter.',
    status: 'todo',
    order: 5,
    createdAt: T0 + 4000,
  },
]

export const DEMO_COMMENTS: Comment[] = [
  {
    id: 'cmt-1',
    path: 'src/routes/orders.route.ts',
    startLine: 8,
    endLine: 8,
    anchorText: '  const status = parseStatus(req.query.status)',
    body: 'parseStatus dropping unknown values to “all” is safe, but should we 400 on a bad status instead of silently widening the result?',
    resolved: false,
    createdAt: T0 + 7000,
  },
  {
    id: 'cmt-2',
    path: 'src/services/orders.service.ts',
    body: 'Good call gating the where-clause on status — keeps the unfiltered query plan unchanged.',
    resolved: false,
    createdAt: T0 + 8000,
  },
]

// Saved actions the human runs one-click in the embedded terminal. Seeded so the
// Cmd+P finder shows mixed results (files + commands) on a query like "orders", and
// the terminal tab's Actions companion isn't an empty state.
export const DEMO_ACTIONS: Action[] = [
  {
    id: 'act-dev',
    title: 'Start dev server',
    command: 'pnpm dev',
    order: 1,
    createdAt: T0,
  },
  {
    id: 'act-orders-tests',
    title: 'Run orders tests',
    command: 'pnpm test src/services/orders',
    order: 2,
    createdAt: T0 + 1000,
  },
  {
    id: 'act-typecheck',
    title: 'Typecheck',
    command: 'pnpm typecheck',
    order: 3,
    createdAt: T0 + 2000,
  },
]

const EVIDENCE_TITLE = 'Loop evidence — status filter'

export const DEMO_EVIDENCE_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <style>
    :root { color-scheme: dark; }
    body { margin: 0; padding: 20px; background: #0b0f17; color: #e2e8f0;
           font-family: ui-sans-serif, system-ui, sans-serif; font-size: 13px; }
    h1 { font-size: 16px; margin: 0 0 4px; }
    .sub { color: #94a3b8; margin: 0 0 16px; }
    .pass { color: #86efac; font-weight: 600; }
    table { border-collapse: collapse; width: 100%; }
    th, td { text-align: left; padding: 6px 10px; border-bottom: 1px solid #1e293b; }
    th { color: #94a3b8; font-weight: 600; }
    code { background: #1e293b; padding: 1px 5px; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>${EVIDENCE_TITLE}</h1>
  <p class="sub">Browser smoke over <code>pnpm dev</code> — <span class="pass">PASS</span></p>
  <table>
    <thead><tr><th>Step</th><th>Action</th><th>Result</th></tr></thead>
    <tbody>
      <tr><td>1</td><td>Open /orders</td><td class="pass">20 orders, newest first</td></tr>
      <tr><td>2</td><td>Select status = FULFILLED</td><td class="pass">GET /api/orders?status=FULFILLED</td></tr>
      <tr><td>3</td><td>Assert every row FULFILLED</td><td class="pass">14/14 rows match</td></tr>
      <tr><td>4</td><td>Clear filter</td><td class="pass">back to 20 orders</td></tr>
    </tbody>
  </table>
</body>
</html>
`

const DEMO_EVIDENCE_CHECKS = [
  { label: 'pnpm test', status: 'pass', detail: '1804 passed' },
  { label: 'Browser smoke — /orders', status: 'pass', detail: '14/14 rows FULFILLED' },
  { label: 'Pagination beyond page 3', status: 'skip', detail: 'no fixture data yet' },
]

const DEMO_EVIDENCE_RUN_LOG = `# Run log

1. \`pnpm dev\` on a clean checkout
2. Opened \`/orders\` — 20 orders, newest first
3. Selected **status = FULFILLED** — one request, correct query string
4. Cleared the filter — back to 20 orders
`

// 16×16 PNGs, base64 so the fixture stays a text file. Real captures would be
// screenshots; the gallery only needs more than one to show its shape.
const DEMO_EVIDENCE_ASSETS: Record<string, string> = {
  'orders-list.png':
    'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFklEQVR4nGNQOhpHEmIY1TCqYfhqAACML0UQHuDXpwAAAABJRU5ErkJggg==',
  'status-filter.png':
    'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFklEQVR4nGOwbvpGEmIY1TCqYfhqAACHB7MQtEO1oAAAAABJRU5ErkJggg==',
}

/**
 * Write demo companion data into `<repo>/.porcelain/` (review parts under
 * `active-review/`) and return home env for the
 * daemon (token home only — channels are project-local).
 */
export async function seedDemoChannels(
  udBase: string,
  repoDir: string,
): Promise<Record<string, string>> {
  const project = join(repoDir, '.porcelain')
  // The unit in flight lives in its own directory, shaped like an archived one.
  const active = join(project, 'active-review')
  await mkdir(active, { recursive: true })
  await writeFile(join(active, 'review.json'), JSON.stringify(DEMO_REVIEW_SET, null, 2))
  await writeFile(join(active, 'comments.json'), JSON.stringify(DEMO_COMMENTS, null, 2))
  await writeFile(join(project, 'board.json'), JSON.stringify(DEMO_BOARD, null, 2))
  await writeFile(join(project, 'actions.json'), JSON.stringify(DEMO_ACTIONS, null, 2))

  // Evidence is one pack over three sub-tabs, so the shots seed all three:
  // checks in meta.json, the report + a run log as documents, captures as images.
  const evidenceDir = join(active, 'evidence')
  await mkdir(join(evidenceDir, 'results'), { recursive: true })
  await mkdir(join(evidenceDir, 'assets'), { recursive: true })
  await writeFile(join(evidenceDir, 'index.html'), DEMO_EVIDENCE_HTML)
  await writeFile(join(evidenceDir, 'results', 'run-log.md'), DEMO_EVIDENCE_RUN_LOG)
  for (const [file, base64] of Object.entries(DEMO_EVIDENCE_ASSETS)) {
    await writeFile(join(evidenceDir, 'assets', file), Buffer.from(base64, 'base64'))
  }
  await writeFile(
    join(evidenceDir, 'meta.json'),
    JSON.stringify({
      title: EVIDENCE_TITLE,
      repoPath: repoDir,
      updatedAt: '2024-05-02T09:15:00.000Z',
      checks: DEMO_EVIDENCE_CHECKS,
    }),
  )
  return { PORCELAIN_HOME: udBase }
}
