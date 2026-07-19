import { execFileSync } from 'node:child_process'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

// The demo repo behind the marketing screenshots (pnpm shots). Same idiom as
// fixture-repo.ts, but richer and NOT a test baseline: a small, generic "orders"
// TypeScript web app whose flow reads Pages → Components → Hooks → Routes →
// Services → Data (matching DEFAULT_LAYERS in src/backend/flow.ts), with a clean
// history plus an uncommitted status-filter feature so the flow-ordered Changes
// tab and the published Review both have real, multi-layer content to render.
//
// Generic names only — no personal setup ever leaks into shipped marketing.

const GIT_ENV = {
  GIT_AUTHOR_NAME: 'Ada Reeves',
  GIT_AUTHOR_EMAIL: 'ada@example.com',
  GIT_COMMITTER_NAME: 'Ada Reeves',
  GIT_COMMITTER_EMAIL: 'ada@example.com',
  GIT_AUTHOR_DATE: '2024-05-02T09:15:00Z',
  GIT_COMMITTER_DATE: '2024-05-02T09:15:00Z',
}

function git(cwd: string, ...args: string[]): void {
  execFileSync('git', args, { cwd, env: { ...process.env, ...GIT_ENV }, stdio: 'pipe' })
}

async function write(dir: string, rel: string, body: string): Promise<void> {
  const full = join(dir, rel)
  await mkdir(dirname(full), { recursive: true })
  await writeFile(full, body)
}

const README = `# Northwind Orders

A small orders module for the storefront admin. Browse orders, page through
them, and (new) filter by fulfilment status.

## Layout

- \`src/pages\` — screens
- \`src/components\` — presentational pieces
- \`src/hooks\` — data hooks
- \`src/routes\` — HTTP handlers
- \`src/services\` — business logic
- \`prisma\` — the data model
`

const PACKAGE_JSON = `{
  "name": "northwind-orders",
  "version": "1.4.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "test": "vitest run",
    "build": "tsc && vite build"
  }
}
`

const SCHEMA_V1 = `datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Order {
  id        String   @id @default(cuid())
  reference String   @unique
  customer  String
  total     Int
  createdAt DateTime @default(now())
}
`

const SCHEMA_V2 = `datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum OrderStatus {
  PENDING
  FULFILLED
  CANCELLED
}

model Order {
  id        String      @id @default(cuid())
  reference String      @unique
  customer  String
  total     Int
  status    OrderStatus @default(PENDING)
  createdAt DateTime    @default(now())
}
`

const SERVICE_V1 = `import { prisma } from '../lib/prisma'

const PAGE_SIZE = 20

export interface Order {
  id: string
  reference: string
  customer: string
  total: number
  createdAt: string
}

/** Fetch one page of orders, newest first. */
export async function listOrders(page: number): Promise<Order[]> {
  const rows = await prisma.order.findMany({
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  })
  return rows.map(toOrder)
}

function toOrder(row: Order & { createdAt: Date }): Order {
  return { ...row, createdAt: row.createdAt.toISOString() }
}
`

const SERVICE_V2 = `import { prisma } from '../lib/prisma'
import type { OrderStatus } from '../types/order-status'

const PAGE_SIZE = 20

export interface Order {
  id: string
  reference: string
  customer: string
  total: number
  status: OrderStatus
  createdAt: string
}

export interface ListOptions {
  page: number
  status?: OrderStatus
}

/** Fetch one page of orders, newest first, optionally narrowed to a status. */
export async function listOrders({ page, status }: ListOptions): Promise<Order[]> {
  const rows = await prisma.order.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  })
  return rows.map(toOrder)
}

function toOrder(row: Order & { createdAt: Date }): Order {
  return { ...row, createdAt: row.createdAt.toISOString() }
}
`

const ROUTE_V1 = `import type { Request, Response } from 'express'
import { listOrders } from '../services/orders.service'

/** GET /api/orders?page= — one page of orders as JSON. */
export async function getOrders(req: Request, res: Response): Promise<void> {
  const page = Number.parseInt(String(req.query.page ?? '1'), 10) || 1
  const orders = await listOrders(page)
  res.json({ page, orders })
}
`

const ROUTE_V2 = `import type { Request, Response } from 'express'
import { listOrders } from '../services/orders.service'
import { parseStatus } from '../types/order-status'

/** GET /api/orders?page=&status= — one page of orders, optionally filtered. */
export async function getOrders(req: Request, res: Response): Promise<void> {
  const page = Number.parseInt(String(req.query.page ?? '1'), 10) || 1
  const status = parseStatus(req.query.status)
  const orders = await listOrders({ page, status })
  res.json({ page, status: status ?? null, orders })
}
`

const HOOK_V1 = `import { useEffect, useState } from 'react'
import type { Order } from '../services/orders.service'

/** Load a page of orders from the API. */
export function useOrders(page: number): { orders: Order[]; loading: boolean } {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(\`/api/orders?page=\${page}\`)
      .then((res) => res.json())
      .then((data: { orders: Order[] }) => setOrders(data.orders))
      .finally(() => setLoading(false))
  }, [page])

  return { orders, loading }
}
`

const HOOK_V2 = `import { useEffect, useState } from 'react'
import type { Order } from '../services/orders.service'
import type { OrderStatus } from '../types/order-status'

/** Load a page of orders from the API, optionally filtered by status. */
export function useOrders(
  page: number,
  status?: OrderStatus,
): { orders: Order[]; loading: boolean } {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const query = new URLSearchParams({ page: String(page) })
    if (status) query.set('status', status)
    fetch(\`/api/orders?\${query.toString()}\`)
      .then((res) => res.json())
      .then((data: { orders: Order[] }) => setOrders(data.orders))
      .finally(() => setLoading(false))
  }, [page, status])

  return { orders, loading }
}
`

const PAGE_V1 = `import { useState } from 'react'
import { useOrders } from '../hooks/useOrders'

export function OrdersPage(): React.JSX.Element {
  const [page, setPage] = useState(1)
  const { orders, loading } = useOrders(page)

  return (
    <main className="orders">
      <h1>Orders</h1>
      {loading ? (
        <p>Loading…</p>
      ) : (
        <ul>
          {orders.map((order) => (
            <li key={order.id}>
              {order.reference} — {order.customer}
            </li>
          ))}
        </ul>
      )}
      <button type="button" onClick={() => setPage((p) => p + 1)}>
        Next page
      </button>
    </main>
  )
}
`

const PAGE_V2 = `import { useState } from 'react'
import { OrderTable } from '../components/OrderTable'
import { useOrders } from '../hooks/useOrders'
import { ORDER_STATUSES, type OrderStatus } from '../types/order-status'

export function OrdersPage(): React.JSX.Element {
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<OrderStatus | undefined>()
  const { orders, loading } = useOrders(page, status)

  return (
    <main className="orders">
      <header className="orders__bar">
        <h1>Orders</h1>
        <select
          value={status ?? ''}
          onChange={(e) => setStatus((e.target.value || undefined) as OrderStatus | undefined)}
        >
          <option value="">All statuses</option>
          {ORDER_STATUSES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </header>
      {loading ? <p>Loading…</p> : <OrderTable orders={orders} />}
      <button type="button" onClick={() => setPage((p) => p + 1)}>
        Next page
      </button>
    </main>
  )
}
`

// New, untracked in the working tree: the presentational table the page now renders.
const ORDER_TABLE = `import type { Order } from '../services/orders.service'

const STATUS_TONE: Record<string, string> = {
  PENDING: 'badge badge--amber',
  FULFILLED: 'badge badge--green',
  CANCELLED: 'badge badge--red',
}

export function OrderTable({ orders }: { orders: Order[] }): React.JSX.Element {
  return (
    <table className="orders__table">
      <thead>
        <tr>
          <th>Reference</th>
          <th>Customer</th>
          <th>Status</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        {orders.map((order) => (
          <tr key={order.id}>
            <td>{order.reference}</td>
            <td>{order.customer}</td>
            <td>
              <span className={STATUS_TONE[order.status] ?? 'badge'}>{order.status}</span>
            </td>
            <td>\${(order.total / 100).toFixed(2)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
`

// New, untracked: the shared status vocabulary the page/hook/route/service all import.
const ORDER_STATUS_TYPE = `export const ORDER_STATUSES = ['PENDING', 'FULFILLED', 'CANCELLED'] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]

/** Coerce an untrusted query value into a known status, or undefined. */
export function parseStatus(value: unknown): OrderStatus | undefined {
  return ORDER_STATUSES.includes(value as OrderStatus) ? (value as OrderStatus) : undefined
}
`

const PRISMA_LIB = `import { PrismaClient } from '@prisma/client'

export const prisma = new PrismaClient()
`

/**
 * Build the marketing demo repo: two clean commits (scaffold, then pagination)
 * followed by an uncommitted "filter orders by status" feature that threads a new
 * status param from the page down to the data model — so the working-tree diff
 * spans Pages, Hooks, Routes, Services, and Data, plus two brand-new files.
 */
export async function createDemoRepo(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true })
  await mkdir(dir, { recursive: true })
  git(dir, 'init', '-b', 'main')

  // Commit 1 — the scaffolded orders module (list + single-page fetch).
  await write(dir, 'README.md', README)
  await write(dir, 'package.json', PACKAGE_JSON)
  await write(dir, 'prisma/schema.prisma', SCHEMA_V1)
  await write(dir, 'src/lib/prisma.ts', PRISMA_LIB)
  await write(dir, 'src/services/orders.service.ts', SERVICE_V1)
  await write(dir, 'src/routes/orders.route.ts', ROUTE_V1)
  await write(dir, 'src/hooks/useOrders.ts', HOOK_V1)
  await write(dir, 'src/pages/OrdersPage.tsx', PAGE_V1)
  git(dir, 'add', '-A')
  git(dir, 'commit', '-m', 'feat: scaffold the orders module')

  // Commit 2 — a small earlier feature, so the history has depth.
  await write(dir, 'src/pages/OrdersPage.tsx', PAGE_V1.replace('Next page', 'Load next page'))
  git(dir, 'add', '-A')
  git(dir, 'commit', '-m', 'feat(orders): relabel the pagination control')

  // Uncommitted work — "filter orders by status", threaded through every layer.
  await write(dir, 'prisma/schema.prisma', SCHEMA_V2)
  await write(dir, 'src/services/orders.service.ts', SERVICE_V2)
  await write(dir, 'src/routes/orders.route.ts', ROUTE_V2)
  await write(dir, 'src/hooks/useOrders.ts', HOOK_V2)
  await write(dir, 'src/pages/OrdersPage.tsx', PAGE_V2)
  await write(dir, 'src/components/OrderTable.tsx', ORDER_TABLE)
  await write(dir, 'src/types/order-status.ts', ORDER_STATUS_TYPE)
}
