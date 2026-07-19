import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

// The agent-channel content behind the marketing screenshots: the published Review,
// the project board, the agent chat, the human's review comments, and loop evidence
// — written to the same on-disk channels the porcelain CLI writes (keyed by absolute
// repo path), so every seeded surface renders exactly as a real agent hand-off would.
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

interface ChatMessage {
  id: string
  from: string
  body: string
  createdAt: number
  files?: string[]
  intent?: string
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

export const DEMO_CHAT: ChatMessage[] = [
  {
    id: 'msg-1',
    from: 'claude-code',
    body: 'Published the status-filter review — the flow reads OrdersPage → useOrders → route → service → schema. Left the CSV export card in To do.',
    createdAt: T0 + 5000,
    files: ['src/services/orders.service.ts', 'src/routes/orders.route.ts'],
    intent: 'filter orders by status',
  },
  {
    id: 'msg-2',
    from: 'codex',
    body: 'Reviewed it — clean seam. I’ll pick up the CSV export next so we don’t both touch the service.',
    createdAt: T0 + 6000,
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

/**
 * Write every agent channel for `repoDir` under `udBase`, and return the env slots
 * that point the daemon at them (the same PORCELAIN_* redirects the e2e harness uses).
 * Review sets live under `udBase`; loop evidence is a per-repo directory keyed like
 * the app (sha256(repoPath).slice(0,16)).
 */
export async function seedDemoChannels(
  udBase: string,
  repoDir: string,
): Promise<Record<string, string>> {
  const files: Record<string, [string, unknown]> = {
    'review-sets.json': ['PORCELAIN_REVIEW_SETS', { [repoDir]: DEMO_REVIEW_SET }],
    'board.json': ['PORCELAIN_BOARD', { [repoDir]: DEMO_BOARD }],
    'chat.json': ['PORCELAIN_CHAT', { [repoDir]: DEMO_CHAT }],
    'comments.json': ['PORCELAIN_COMMENTS', { [repoDir]: DEMO_COMMENTS }],
    'actions.json': ['PORCELAIN_ACTIONS', {}],
    'layers.json': ['PORCELAIN_LAYERS', {}],
    'reviewed.json': ['PORCELAIN_REVIEWED', {}],
    'notes.json': ['PORCELAIN_NOTES', {}],
    'feature-view.json': ['PORCELAIN_FEATURE_VIEW', {}],
    'evidence.json': ['PORCELAIN_EVIDENCE', {}],
  }
  const env: Record<string, string> = {}
  for (const [name, [envVar, value]] of Object.entries(files)) {
    const path = join(udBase, name)
    await writeFile(path, JSON.stringify(value, null, 2))
    env[envVar] = path
  }

  // Loop evidence is a directory of files (index.html + meta.json), not JSON.
  const evidenceRoot = join(udBase, 'loop-evidence')
  const key = createHash('sha256').update(repoDir).digest('hex').slice(0, 16)
  const evidenceDir = join(evidenceRoot, key)
  await mkdir(evidenceDir, { recursive: true })
  await writeFile(join(evidenceDir, 'index.html'), DEMO_EVIDENCE_HTML)
  await writeFile(
    join(evidenceDir, 'meta.json'),
    JSON.stringify({
      title: EVIDENCE_TITLE,
      repoPath: repoDir,
      updatedAt: '2024-05-02T09:15:00.000Z',
    }),
  )
  env.PORCELAIN_LOOP_EVIDENCE_DIR = evidenceRoot
  return env
}
