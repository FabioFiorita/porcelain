import { createHash } from 'node:crypto'
import { porcelainHome, porcelainHomePath } from '@shared/porcelain-home'
import { createDaemonOperations, createDaemonRouter } from './api'
import { ensureCli } from './cli-install'
import { devRepoPath, recognizedDevPlaygroundPath, seedDevConfig } from './dev-config'
import { createGitSubprocess } from './features/git'
import {
  createCanvasAccessTokens,
  createCanvasOverlayStore,
  createCanvasStore,
  createHubGitPort,
  createNodeProjectsPort,
  createProjectsOperations,
  initEnvironmentIdentityStore,
  initHubInventoryStore,
  initProjectsRecentsDir,
} from './features/projects'
import {
  authenticateClientToken,
  createRemoteHttp,
  ensureDevClientToken,
  exchangePairingGrant,
  initConfigDir,
  initIfaceHandlers,
  loadConfig,
  setCloudflareDaemonPort,
  startCloudflare,
  startLanListener,
  startTailnetListener,
} from './features/remote'
import { createTasksAttachments, createTasksStore } from './features/tasks'
import {
  createPtyAdapter,
  createTerminalEnvironment,
  createTerminalOperations,
  createTerminalPasteAdapter,
} from './features/terminal'
import { warmFileList } from './git/git'
import { isLinkedWorktree } from './git/linked-worktree'
import { ensureAdminToken } from './net/admin-token'
import { handleCanvasRequest } from './net/canvas-http'
import { daemonIdentity } from './net/daemon-identity'
import { rendererDistExists, serveStatic } from './net/static-server'
import { createSession, publishSessionChange } from './session/live-session'

/**
 * The daemon entry point — the Electron-free half of Porcelain, forked by the shell
 * (`src/main/daemon.ts`) and built as its own bundle (`out/main/daemon/server.js`,
 * see electron.vite.config.ts). It serves the appRouter over HTTP (`/trpc`, tRPC's
 * fetch adapter) and the per-window session channel over one WebSocket (`/session`,
 * see session/live-session.ts and @porcelain/contracts/session).
 *
 * SECURITY INVARIANTS live in the Remote boundary and must hold here:
 * binds are 127.0.0.1 ALWAYS plus, on opt-in, the enumerated Tailscale/RFC1918
 * addresses through these same handlers — never 0.0.0.0; every privileged request is
 * token-gated ALWAYS (`authorization: Bearer` on /trpc, the `porcelain.<token>`
 * subprotocol on the WS upgrade — chosen over `?token=`, which would leak the token
 * into logs and proxies); `POST /pair` is the one unauthenticated route in production.
 * A development daemon (PORCELAIN_DEV) also exposes `GET /dev-auth`, which hands the
 * browser a real client token so the pairing step is not repeated per browser context.
 * The Bearer gate still runs on every request behind it; production never wires it.
 *
 * Contract with the shell: exactly ONE stdout line, `{"port": N}`, once listening
 * (everything else goes to stderr, and the token is NEVER printed), and self-exit
 * when stdin ends OR the parent pid changes — never linger as an orphan squatting
 * the second-listener port (PORCELAIN_NO_STDIN_WATCHDOG block below).
 */

// The shell resolves userData (it owns the dev `-dev` suffix) and hands the
// config dir down; refusing to start without it beats writing config.json
// somewhere surprising.
const userData: string | undefined = process.env.PORCELAIN_USER_DATA
if (userData === undefined || userData === '') {
  console.error('[daemon] PORCELAIN_USER_DATA is required')
  process.exit(1)
}
initConfigDir(userData)
const projectsRecents = initProjectsRecentsDir(userData)
const porcelainHomeDir = porcelainHome()
const identity = daemonIdentity()
const environmentIdentity = initEnvironmentIdentityStore({
  directory: porcelainHomeDir,
  defaultName: identity.host,
})
const hubInventory = initHubInventoryStore(porcelainHomeDir)
// One shared accessTokens instance: a token minted through tRPC (mintCanvasAccessToken)
// must resolve against the SAME in-memory grant map the GET /canvas/<token> route reads
// from (the Canvas operations only expose mint, not resolve — that's this route's own concern).
const canvasAccessTokens = createCanvasAccessTokens()
const canvasStores = {
  store: createCanvasStore({ homeDir: porcelainHomeDir }),
  overlay: createCanvasOverlayStore(),
  accessTokens: canvasAccessTokens,
}

// The single daemon shutdown path. Every shutdown route (SIGTERM from the shell's
// utilityProcess.kill, SIGINT at a TTY, or the stdin-EOF watchdog) converges here.
let shuttingDown = false
function shutdown(): void {
  if (shuttingDown) return
  shuttingDown = true
  process.exit(0)
}
// utilityProcess.kill() (the shell's teardown) sends SIGTERM; a standalone `node` daemon at
// a TTY gets SIGINT. Registering a listener suppresses the default terminate, so we must exit
// ourselves.
process.on('SIGTERM', () => shutdown())
process.on('SIGINT', () => shutdown())

// The administrator token is local-only. The shell passes it via env; a
// non-interactive standalone daemon can load/create the same 0600 file for its
// host CLI. Interactive raw-server runs must opt in explicitly so a mistyped
// launch cannot silently mint an administrator credential.
async function resolveAdminToken(): Promise<string> {
  const fromEnv = process.env.PORCELAIN_ADMIN_TOKEN
  if (fromEnv !== undefined && fromEnv !== '') return fromEnv
  if (process.stdin.isTTY) {
    console.error(
      '[daemon] PORCELAIN_ADMIN_TOKEN is required — set it or create ~/.porcelain/admin-token before starting the daemon',
    )
    process.exit(1)
  }
  return ensureAdminToken()
}

// The whole request/upgrade pipeline lives in the factory (createRemoteHttp) so it
// can be booted for real in a test; the entry file only resolves its inputs. Built
// in main() (below) once the token is known — a `let` because the token resolves
// asynchronously (env or file), and the digest must exist before either listener
// accepts a connection (the factory takes it as input, so that ordering is now
// structural).
let daemon: ReturnType<typeof createRemoteHttp>

async function main(): Promise<void> {
  // Resolve the local administrator credential and precompute its digest BEFORE
  // any listener accepts a connection. The plaintext is never logged.
  const token = await resolveAdminToken()
  const tokenHash = createHash('sha256').update(token).digest()

  // CORS is scoped, not `*`: the shell passes the dev renderer's origin via
  // PORCELAIN_ALLOWED_ORIGIN (the Vite server). A standalone daemon may provide a
  // comma-separated list through PORCELAIN_ALLOWED_ORIGIN or PORCELAIN_ALLOWED_ORIGINS
  // so a primary Hub can connect from another machine. The packaged file:// renderer
  // sends a literal "null" origin the factory always echoes. See createRemoteHttp.
  // Compose the bound-operation catalog and flat router once before any listener
  // accepts a request — never per request, never as a module singleton.
  const terminalEnvironment = createTerminalEnvironment()
  const terminal = createTerminalOperations({
    pty: createPtyAdapter({ environment: terminalEnvironment }),
    paste: createTerminalPasteAdapter({ root: porcelainHomePath('terminal-pastes') }),
    publishChange: publishSessionChange,
  })
  const projects = createProjectsOperations({
    // Dev-only: fleet playground fixtures (pnpm playground new) live under a dot-prefixed
    // .fleet segment (see CreateNodeProjectsPortOptions); a production daemon still hides
    // dotfiles from the picker.
    projects: createNodeProjectsPort({ showHidden: process.env.PORCELAIN_DEV === '1' }),
    recents: projectsRecents,
    worktree: { isLinkedWorktree },
    effects: { warmFileList },
    hub: {
      environment: environmentIdentity,
      inventory: hubInventory,
      git: createHubGitPort(createGitSubprocess()),
      daemon: identity,
      // A development daemon is an agent playground, never a way to open the
      // host's real checkouts. Production daemons omit PORCELAIN_DEV entirely,
      // so this boundary cannot change their project behavior.
      pathAllowed:
        process.env.PORCELAIN_DEV === '1'
          ? (path: string): string | null => recognizedDevPlaygroundPath(path, devRepoPath())
          : undefined,
    },
    canvas: canvasStores,
  })
  const operations = createDaemonOperations({
    projects,
    tasks: {
      store: createTasksStore({ homeDir: porcelainHomeDir }),
      attachments: createTasksAttachments({ homeDir: porcelainHomeDir }),
    },
    terminal,
    homeDir: porcelainHomeDir,
  })
  const router = createDaemonRouter({ operations })
  daemon = createRemoteHttp({
    adminTokenHash: tokenHash,
    authenticateClient: authenticateClientToken,
    exchangePairing: exchangePairingGrant,
    allowedOrigin: [process.env.PORCELAIN_ALLOWED_ORIGIN, process.env.PORCELAIN_ALLOWED_ORIGINS]
      .filter((value): value is string => value !== undefined && value !== '')
      .join(','),
    router,
    onSession: (socket, identity) => createSession(socket, identity, terminal),
    serveStatic,
    serveCanvas: (req, res) =>
      handleCanvasRequest(req, res, {
        resolveAccessToken: canvasAccessTokens.resolve,
        readCanvas: projects.readCanvas,
      }),
    // A dev daemon hands its browser a real client token instead of demanding a pairing
    // link every context — the same provisioning the e2e harness already does, and the
    // Bearer gate still runs on every request afterwards. Production omits the option, so
    // the route does not exist there. `--no-auto-auth` (PORCELAIN_DEV_AUTO_AUTH=0) restores
    // the pairing flow for when the pairing flow itself is what needs proving.
    devAutoAuth:
      process.env.PORCELAIN_DEV === '1' && process.env.PORCELAIN_DEV_AUTO_AUTH !== '0'
        ? ensureDevClientToken
        : undefined,
  })

  // Hand the shared handlers to the second-listener module so its optional
  // tailnet + LAN listeners (started/stopped live from the API) behave identically
  // to loopback — same token gate, never 0.0.0.0.
  initIfaceHandlers(daemon.requestListener, daemon.handleUpgrade)

  // The daemon serves the renderer dist to the browser client (Phase 3). In dev
  // the daemon runs before any build, so the dist is legitimately absent — log
  // once (static requests 404 until a build exists) instead of failing.
  if (!rendererDistExists()) {
    console.error(
      '[daemon] renderer dist not found — the browser client is unavailable until `pnpm build` runs (loopback + tRPC unaffected)',
    )
  }

  // Dev seeding moved here from the shell with the Projects-recents store: the
  // playground recent is Project state, and the daemon owns that document now. Same semantics —
  // gated on dev (the shell sets PORCELAIN_DEV from `is.dev`) and a no-op once
  // any recent exists.
  if (process.env.PORCELAIN_DEV === '1') await seedDevConfig()

  // Refresh the bundled CLI agents run (`~/.porcelain/porcelain <noun> <verb>`).
  // Same contract as the Mac shell boot path (`src/main/index.ts`): every daemon
  // start re-copies the bundle + wrapper from this package, so a daemon upgrade
  // (npx porcelain-daemon@latest on Linux, or a Mac app update) ships new commands
  // automatically — agents run a binary, so there's nothing to re-register.
  // Best-effort: a missing build artifact or home-dir write failure must never block
  // the listener (agents keep whatever copy they already had).
  try {
    await ensureCli()
  } catch (error) {
    console.error('[daemon] CLI refresh failed:', error)
  }

  // Port 0 = OS-assigned (the default); PORCELAIN_DAEMON_PORT pins it (e2e/debugging).
  const requestedPort = Number(process.env.PORCELAIN_DAEMON_PORT ?? '') || 0
  const listeningPort = await new Promise<number>((resolve) => {
    daemon.server.listen(requestedPort, '127.0.0.1', () => {
      const address = daemon.server.address()
      if (address !== null && typeof address === 'object') {
        process.stdout.write(`${JSON.stringify({ port: address.port })}\n`)
        resolve(address.port)
      }
    })
  })
  setCloudflareDaemonPort(listeningPort)

  // If the user has the tailnet and/or LAN bind enabled — persisted config OR the
  // boot env override (PORCELAIN_TAILNET_BIND / PORCELAIN_LAN_BIND = '1', so a
  // headless/systemd daemon can share with no GUI and no config edit; the env
  // FORCE-enables without flipping persisted config, keeping the unit file the
  // source of truth) — bring the second listener(s) up too. A missing interface
  // (or a listen error) at boot must NOT crash or block the loopback listener —
  // the start functions log to stderr and resolve null.
  const bootConfig = await loadConfig()
  if (bootConfig.tailnetBind === true || process.env.PORCELAIN_TAILNET_BIND === '1') {
    await startTailnetListener()
  }
  if (bootConfig.lanBind === true || process.env.PORCELAIN_LAN_BIND === '1') {
    await startLanListener()
  }
  if (bootConfig.cloudflareBind === true || process.env.PORCELAIN_CLOUDFLARE_BIND === '1') {
    await startCloudflare().catch((error) => {
      console.error('[daemon] Cloudflare tunnel failed to start:', error)
    })
  }

  // Parent-death watchdog: the shell holds our stdin pipe open for our lifetime,
  // so stdin ending means the Electron process is gone — exit instead of orphaning.
  // Escape hatch for the standalone daemon package (remote-environments Phase 4):
  // a supervisor like systemd hands stdin as /dev/null, which reads EOF
  // immediately and would kill the daemon on boot. PORCELAIN_NO_STDIN_WATCHDOG=1
  // opts out. FAIL CLOSED — the watchdog stays armed unless the var is exactly '1',
  // so the shell (which never sets it) keeps the orphan protection.
  if (process.env.PORCELAIN_NO_STDIN_WATCHDOG !== '1') {
    process.stdin.resume()
    process.stdin.on('end', () => shutdown())
    process.stdin.on('close', () => shutdown())
    // Companion check: reap orphans whose stdin never EOFs (e.g. a standalone/dev
    // daemon whose spawning shell died) so they can't squat the fixed second-listener
    // port forever. On Unix `ppid` changes ONLY when the original parent dies (the
    // process is reparented to init/a subreaper), so key on the ppid CHANGING — NOT
    // on `ppid === 1`: under systemd, pid 1 IS the parent, so a service-born daemon
    // has initialPpid === 1 from the start, it never changes, and it is never
    // mistaken for an orphan. (Supervised deployments set PORCELAIN_NO_STDIN_WATCHDOG=1
    // anyway and skip this whole block — their supervisor owns the lifecycle.)
    const initialPpid = process.ppid
    const orphanPoll = setInterval(() => {
      if (process.ppid !== initialPpid) shutdown()
    }, 5000)
    orphanPoll.unref()
  }
}

main().catch((error) => {
  console.error('[daemon] failed to start:', error)
  process.exit(1)
})
