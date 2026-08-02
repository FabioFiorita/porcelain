#!/usr/bin/env node
import { createServer } from 'node:http'

/**
 * Deterministic daemon-shaped fixture for mobile simulator runs.
 *
 * It intentionally lives outside the mobile bundle. The app talks to this process through the
 * same pairing, bearer/tRPC, and session-WebSocket protocols as a real daemon, so simulator
 * proof exercises the normal environment and connection-group code paths.
 *
 * Usage:
 *   node scripts/mobile-fixture-daemon.mjs
 *   node scripts/mobile-fixture-daemon.mjs --port 43118 --second-port 43119
 */
import { createRequire } from 'node:module'
import { networkInterfaces } from 'node:os'

const mobileRequire = createRequire(new URL('../apps/mobile/package.json', import.meta.url))
const desktopRequire = createRequire(new URL('../apps/desktop/package.json', import.meta.url))
const { initTRPC } = mobileRequire('@trpc/server')
const { fetchRequestHandler } = mobileRequire('@trpc/server/adapters/fetch')
const { z } = mobileRequire('zod')
const { WebSocketServer } = desktopRequire('ws')

const DEFAULT_PORT = 43118
const FIXTURE_REPO = '/fixture/mobile-changes'
const FIXTURE_TOKEN = 'pc_client_mobile_fixture'
const CORS = {
  'access-control-allow-headers': 'authorization,content-type,x-trpc-source',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-origin': '*',
}

const state = {
  commits: [
    {
      author: 'Fixture Bot',
      date: '2026-08-01T12:00:00.000Z',
      hash: 'fixture-base-0001',
      subject: 'chore: seed mobile fixture',
    },
  ],
  commitFlows: new Map(),
  commitMessages: new Map([['fixture-base-0001', 'chore: seed mobile fixture\n']]),
  files: new Map(),
  pushed: false,
  reviewed: new Set(),
  sessions: new Set(),
}

function makeHunks(label, kind = 'mixed') {
  const lines = Array.from({ length: 18 }, (_, index) => {
    const line = index + 1
    const isAdd = kind === 'added' || (kind === 'mixed' && index === 3)
    const isDelete = kind === 'mixed' && index === 8
    return {
      kind: isAdd ? 'add' : isDelete ? 'del' : 'context',
      newLine: isDelete ? null : line,
      oldLine: isAdd ? null : line,
      text: `${label} fixture line ${line}`,
    }
  })
  return [{ header: '@@ -1,18 +1,18 @@', lines }]
}

const fileSeeds = [
  {
    additions: 4,
    connects: [],
    defaultStaged: false,
    defaultUnstaged: true,
    deletions: 1,
    hunkLabel: 'README',
    layer: 'Docs',
    path: 'README.md',
    status: 'modified',
  },
  {
    additions: 6,
    connects: [],
    defaultStaged: true,
    defaultUnstaged: false,
    deletions: 2,
    hunkLabel: 'source',
    layer: 'Source',
    path: 'src/fixture.ts',
    status: 'modified',
  },
  {
    additions: 18,
    connects: [],
    defaultStaged: false,
    defaultUnstaged: true,
    deletions: 0,
    hunkLabel: 'deterministic',
    layer: 'Docs',
    path: 'docs/deterministic-fixture.md',
    status: 'added',
  },
]

for (const seed of fileSeeds) {
  state.files.set(seed.path, {
    ...seed,
    hunks: makeHunks(seed.hunkLabel, seed.status === 'added' ? 'added' : 'mixed'),
    staged: seed.defaultStaged,
    unstaged: seed.defaultUnstaged,
  })
}

const t = initTRPC.create()
const repoPathInput = z.object({ repoPath: z.string() })
const filePathInput = z.object({ repoPath: z.string(), path: z.string() })
const reviewedInput = z.object({ repoPath: z.string(), path: z.string() })
const scopeInput = z.object({
  repoPath: z.string(),
  scope: z.union([
    z.object({ type: z.literal('working') }),
    z.object({ type: z.literal('commit'), hash: z.string() }),
  ]),
})

function flowFile(file, includeStage = true) {
  return {
    additions: file.additions,
    connects: file.connects,
    ...(includeStage ? { staged: file.staged, unstaged: file.unstaged } : {}),
    deletions: file.deletions,
    path: file.path,
    status: file.status,
  }
}

function flowGroups(files = [...state.files.values()], includeStage = true) {
  const layers = []
  for (const layer of ['Docs', 'Source']) {
    const layerFiles = files.filter((file) => file.layer === layer)
    if (layerFiles.length > 0) {
      layers.push({
        files: layerFiles.map((file) => flowFile(file, includeStage)),
        layer,
      })
    }
  }
  return layers
}

function readingGroups(files = [...state.files.values()]) {
  return flowGroups(files, false).map((group) => ({
    files: group.files.map((file) => ({
      additions: file.additions,
      deletions: file.deletions,
      hunks: files.find((candidate) => candidate.path === file.path)?.hunks ?? [],
      path: file.path,
      status: file.status,
    })),
    layer: group.layer,
  }))
}

function findFile(path) {
  return state.files.get(path) ?? fileSeeds.find((file) => file.path === path)
}

function snapshotFiles() {
  return [...state.files.values()].map((file) => ({
    ...file,
    staged: undefined,
    unstaged: undefined,
  }))
}

function broadcastWorkingTree() {
  const frame = JSON.stringify({ event: 'working-tree', t: 'app-event' })
  for (const session of state.sessions) {
    if (session.readyState === 1) session.send(frame)
  }
}

function mutateWorkingTree(change) {
  change()
  broadcastWorkingTree()
}

state.commitFlows.set('fixture-base-0001', flowGroups([...state.files.values()], false))

function commit(message) {
  const committed = snapshotFiles()
  const hash = `fixture-${String(state.commits.length + 1).padStart(4, '0')}`
  const subject = message.trim().split('\n')[0] ?? message.trim()
  state.commitFlows.set(hash, flowGroups(committed, false))
  state.commitMessages.set(hash, `${message.trim()}\n`)
  state.commits.unshift({
    author: 'Simulator User',
    date: '2026-08-01T12:05:00.000Z',
    hash,
    subject,
  })
  state.files.clear()
  state.reviewed.clear()
  state.pushed = false
}

const router = t.router({
  browseDirs: t.procedure.input(z.string().nullable()).query(({ input }) => ({
    entries:
      input === null
        ? [{ isRepo: false, name: 'fixture', path: '/fixture' }]
        : [{ isRepo: true, name: 'mobile-changes', path: FIXTURE_REPO }],
    parent: input === null ? null : '/fixture',
    path: input ?? '/',
  })),
  daemonInfo: t.procedure.query(() => ({
    arch: 'fixture',
    host: 'mobile-fixture',
    platform: 'simulator',
    version: 'fixture-1.0.0',
  })),
  diffReading: t.procedure.input(scopeInput).query(({ input }) => {
    const files = input.scope.type === 'working' ? [...state.files.values()] : []
    return { groups: readingGroups(files), name: 'mobile fixture' }
  }),
  gitCommitConventions: t.procedure.input(z.string()).query(() => ({
    scopes: ['mobile', 'daemon'],
    types: ['feat', 'fix', 'test', 'chore'],
  })),
  gitCommitDiff: t.procedure
    .input(z.object({ filePath: z.string(), hash: z.string(), repoPath: z.string() }))
    .query(({ input }) =>
      state.commitFlows
        .get(input.hash)
        ?.flatMap((group) => group.files)
        .find((file) => file.path === input.filePath)
        ? (findFile(input.filePath)?.hunks ?? [])
        : [],
    ),
  gitCommitFlow: t.procedure
    .input(z.object({ hash: z.string(), repoPath: z.string() }))
    .query(({ input }) => state.commitFlows.get(input.hash) ?? []),
  gitCommitMessage: t.procedure
    .input(z.object({ hash: z.string(), repoPath: z.string() }))
    .query(({ input }) => state.commitMessages.get(input.hash) ?? ''),
  gitCommit: t.procedure
    .input(z.object({ message: z.string().trim().min(1), repoPath: z.string() }))
    .mutation(({ input }) => {
      mutateWorkingTree(() => commit(input.message))
      return undefined
    }),
  gitDiffFile: t.procedure
    .input(z.object({ filePath: z.string(), repoPath: z.string() }))
    .query(({ input }) => {
      const file = findFile(input.filePath)
      return {
        binary: false,
        hunks: file?.hunks ?? [],
        status: file?.status ?? 'modified',
      }
    }),
  gitFlow: t.procedure.input(z.string()).query(() => flowGroups()),
  gitHead: t.procedure.query(() => ({ branch: 'fixture/main', detachedSha: null })),
  gitLog: t.procedure
    .input(z.object({ limit: z.number().int().max(500).default(200), repoPath: z.string() }))
    .query(({ input }) => state.commits.slice(0, input.limit)),
  gitPush: t.procedure.input(repoPathInput).mutation(() => {
    state.pushed = true
    return 'Pushed fixture branch fixture/main.'
  }),
  gitStageAll: t.procedure.input(repoPathInput).mutation(() => {
    mutateWorkingTree(() => {
      for (const file of state.files.values()) {
        file.staged = true
        file.unstaged = false
      }
    })
    return undefined
  }),
  gitStageFile: t.procedure.input(filePathInput).mutation(({ input }) => {
    mutateWorkingTree(() => {
      const file = state.files.get(input.path)
      if (file !== undefined) {
        file.staged = true
        file.unstaged = false
      }
    })
    return undefined
  }),
  gitSuggestions: t.procedure
    .input(z.string())
    .query(() => (state.pushed ? [] : [{ command: 'push', reason: '1 fixture commit ahead' }])),
  gitUnstageAll: t.procedure.input(repoPathInput).mutation(() => {
    mutateWorkingTree(() => {
      for (const file of state.files.values()) {
        file.staged = false
        file.unstaged = true
      }
    })
    return undefined
  }),
  gitUnstageFile: t.procedure.input(filePathInput).mutation(({ input }) => {
    mutateWorkingTree(() => {
      const file = state.files.get(input.path)
      if (file !== undefined) {
        file.staged = false
        file.unstaged = true
      }
    })
    return undefined
  }),
  gitDiscardFile: t.procedure.input(filePathInput).mutation(({ input }) => {
    mutateWorkingTree(() => {
      state.files.delete(input.path)
      state.reviewed.delete(input.path)
    })
    return undefined
  }),
  markReviewed: t.procedure.input(reviewedInput).mutation(({ input }) => {
    mutateWorkingTree(() => state.reviewed.add(input.path))
    return undefined
  }),
  openRepoPath: t.procedure
    .input(z.string())
    .mutation(() => ({ name: 'mobile-changes', path: FIXTURE_REPO })),
  recentRepos: t.procedure
    .input(z.object({ includeWorktrees: z.boolean() }))
    .query(() => [{ name: 'mobile-changes', path: FIXTURE_REPO }]),
  removeRecentRepo: t.procedure.input(z.string()).mutation(() => undefined),
  reviewedPaths: t.procedure.input(z.string()).query(() => [...state.reviewed]),
  revokeCurrentClient: t.procedure.mutation(() => undefined),
  setReviewed: t.procedure
    .input(z.object({ paths: z.array(z.string()), repoPath: z.string() }))
    .mutation(({ input }) => {
      mutateWorkingTree(() => {
        state.reviewed = new Set(input.paths)
      })
      return undefined
    }),
})

const clientMessageSchema = z.discriminatedUnion('t', [
  z.object({ repo: z.string().max(1024).optional(), t: z.literal('session:hello') }),
  z.object({
    cols: z.number().int().positive().optional(),
    cwd: z.string(),
    initialInput: z.string().optional(),
    name: z.string(),
    reqId: z.string(),
    rows: z.number().int().positive().optional(),
    t: z.literal('terminal:create'),
  }),
  z.object({ id: z.string(), reqId: z.string(), t: z.literal('terminal:attach') }),
  z.object({ id: z.string(), t: z.literal('terminal:detach') }),
  z.object({ data: z.string(), id: z.string(), t: z.literal('terminal:write') }),
  z.object({
    cols: z.number().int(),
    id: z.string(),
    rows: z.number().int(),
    t: z.literal('terminal:resize'),
  }),
  z.object({ id: z.string(), t: z.literal('terminal:kill') }),
  z.object({ paths: z.array(z.string()), t: z.literal('watch:files') }),
  z.object({ paths: z.array(z.string()), t: z.literal('watch:dirs') }),
])

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = []
    request.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
    request.on('end', () => resolve(Buffer.concat(chunks)))
    request.on('error', reject)
  })
}

function sendJson(response, status, body) {
  const data = Buffer.from(JSON.stringify(body))
  response.writeHead(status, {
    ...CORS,
    'cache-control': 'no-store',
    'content-length': String(data.byteLength),
    'content-type': 'application/json',
  })
  response.end(data)
}

function tokenFromRequest(request) {
  const authorization = request.headers.authorization
  return typeof authorization === 'string' && authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : ''
}

function isAuthorized(token) {
  // This process is a simulator-only fixture; accepting the already-stored dev token makes it
  // possible to swap the daemon underneath an existing paired environment without touching app
  // code or SecureStore. Pairing still mints the stable fixture token for a clean simulator.
  return token !== ''
}

async function handleRequest(request, response) {
  const url = request.url ?? '/'
  if (request.method === 'OPTIONS') {
    response.writeHead(204, CORS)
    response.end()
    return
  }

  if (url === '/pair' && request.method === 'POST') {
    let payload
    try {
      payload = JSON.parse((await readBody(request)).toString('utf8'))
    } catch {
      sendJson(response, 400, { error: 'invalid pairing payload' })
      return
    }
    const credential = typeof payload.credential === 'string' ? payload.credential : ''
    if (!credential.startsWith('pc_pair_fixture') || redeemedCredentials.has(credential)) {
      sendJson(response, 401, { error: 'pairing grant expired' })
      return
    }
    redeemedCredentials.add(credential)
    sendJson(response, 200, { token: FIXTURE_TOKEN })
    return
  }

  if (!url.startsWith('/trpc')) {
    sendJson(response, 404, { error: 'not found' })
    return
  }
  if (!isAuthorized(tokenFromRequest(request))) {
    sendJson(response, 401, { error: 'unauthorized' })
    return
  }

  const method = request.method ?? 'GET'
  const headers = new Headers()
  for (const [key, value] of Object.entries(request.headers)) {
    if (typeof value === 'string') headers.set(key, value)
    if (Array.isArray(value)) for (const item of value) headers.append(key, item)
  }
  const body =
    method === 'GET' || method === 'HEAD' ? undefined : new Uint8Array(await readBody(request))
  const result = await fetchRequestHandler({
    createContext: () => ({}),
    endpoint: '/trpc',
    req: new Request(`http://mobile-fixture.local${url}`, { body, headers, method }),
    router,
  })
  response.writeHead(result.status, {
    ...CORS,
    ...Object.fromEntries(result.headers.entries()),
  })
  response.end(Buffer.from(await result.arrayBuffer()))
}

const redeemedCredentials = new Set()

function onSession(socket) {
  state.sessions.add(socket)
  socket.on('message', (raw) => {
    let payload
    try {
      payload = JSON.parse(raw.toString())
    } catch {
      socket.close(1008, 'invalid session message')
      return
    }
    const parsed = clientMessageSchema.safeParse(payload)
    if (!parsed.success) {
      socket.close(1008, 'invalid session message')
    }
  })
  socket.on('close', () => state.sessions.delete(socket))
  socket.on('error', () => state.sessions.delete(socket))
}

function rejectUpgrade(socket) {
  socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n')
  socket.destroy()
}

function createFixtureServer(port) {
  const webSocketServer = new WebSocketServer({ noServer: true })
  const server = createServer((request, response) => {
    handleRequest(request, response).catch((error) => {
      console.error(`[mobile-fixture:${port}] request failed`, error)
      if (!response.headersSent) sendJson(response, 500, { error: 'fixture request failed' })
      else response.end()
    })
  })
  server.on('upgrade', (request, socket, head) => {
    const offered = String(request.headers['sec-websocket-protocol'] ?? '')
      .split(',')
      .map((protocol) => protocol.trim())
    const candidate = offered.find((protocol) => protocol.startsWith('porcelain.'))
    if (
      request.url !== '/session' ||
      candidate === undefined ||
      !isAuthorized(candidate.slice(10))
    ) {
      rejectUpgrade(socket)
      return
    }
    webSocketServer.handleUpgrade(request, socket, head, onSession)
  })
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '0.0.0.0', () => {
      server.removeListener('error', reject)
      resolve(server)
    })
  })
}

function parsePort(value, flag) {
  const port = Number(value)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${flag} needs an integer between 1 and 65535`)
  }
  return port
}

function parseArgs(argv) {
  const options = { host: null, port: DEFAULT_PORT, secondPort: null }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--port') options.port = parsePort(argv[++index], '--port')
    else if (arg === '--second-port') options.secondPort = parsePort(argv[++index], '--second-port')
    else if (arg === '--public-host') options.host = argv[++index]
    else if (arg === '--help') return { ...options, help: true }
    else throw new Error(`Unknown option: ${arg}`)
  }
  return options
}

function defaultHost() {
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) return entry.address
    }
  }
  return '127.0.0.1'
}

function printHelp() {
  console.log(`Mobile fixture daemon

  node scripts/mobile-fixture-daemon.mjs [--port 43118] [--second-port 43119]

The process is a deterministic, in-memory daemon for simulator proof. It accepts the existing
dev pairing token and also exposes pairing links for a clean environment group:
`)
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    printHelp()
    return
  }
  const ports = [options.port, ...(options.secondPort === null ? [] : [options.secondPort])]
  const servers = await Promise.all(ports.map((port) => createFixtureServer(port)))
  const host = options.host ?? defaultHost()
  console.log(`[mobile-fixture] shared state ready on ${ports.join(', ')}`)
  console.log(`[mobile-fixture] pairing: http://${host}:${ports[0]}/pair#token=pc_pair_fixture`)
  if (options.secondPort !== null) {
    console.log(
      `[mobile-fixture] second connection: http://${host}:${options.secondPort}/pair#token=pc_pair_fixture_2`,
    )
  }
  console.log(`[mobile-fixture] repo: ${FIXTURE_REPO}`)
  console.log('[mobile-fixture] stop with Ctrl-C')

  const close = () => {
    for (const server of servers) server.close()
    for (const session of state.sessions) session.close()
  }
  process.once('SIGINT', () => {
    close()
    process.exit(0)
  })
  process.once('SIGTERM', () => {
    close()
    process.exit(0)
  })
}

main().catch((error) => {
  console.error('[mobile-fixture]', error instanceof Error ? error.message : error)
  process.exit(1)
})
