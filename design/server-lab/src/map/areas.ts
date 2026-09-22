import type {
  Area,
  Flow,
  Layer,
  SourceRef,
  Step,
  WebTrigger,
} from './types.ts';

// Curated map of the Porcelain server, traced from the working tree on
// 2026-09-18 (including the uncommitted evidence batching and cache).
// Cost symbols: N = changed files, W = worktrees of the repository,
// P = registered projects, K = available worktrees in the sidebar,
// L = commits per history page. Process counts are Git child processes.

const APP = 'apps/server/src/app.ts';
const RUNNER = 'apps/server/src/lifecycle/lanes.ts';
const COORDINATOR = 'apps/server/src/lifecycle/git-action-coordinator.ts';
const route = (file: string) => `apps/server/src/http/routes/${file}`;
const caseFile = (file: string) => `apps/server/src/use-cases/${file}`;
const repo = (file: string) => `apps/server/src/repositories/${file}`;
const fsys = (file: string) => `apps/server/src/filesystem/${file}`;
const git = (file: string) => `packages/git/src/${file}`;
const web = (file: string) => `apps/web/src/${file}`;
const doc = (file: string) => `docs/decisions/${file}`;

function at(path: string, line?: number): SourceRef {
  return line === undefined ? { path } : { path, line };
}

function s(
  layer: Layer,
  name: string,
  what: string,
  path: string,
  line?: number,
): Step {
  return { layer, name, what, source: at(path, line) };
}

function wt(
  hook: string,
  path: string,
  line: number,
  when: string,
): WebTrigger {
  return { hook, source: at(path, line), when };
}

const FOCUS = `staleTime Infinity with the global refetchOnWindowFocus and refetchOnReconnect set to 'always' (query/client.ts:12-13), so it refetches on every window focus and reconnect, stale or not.`;

const INVENTORY_READ: Flow['tables'] = [
  { name: 'environment', access: 'read' },
  { name: 'inventory_projects', access: 'read' },
  { name: 'worktrees', access: 'read' },
];

const INVENTORY_WRITE: Flow['tables'] = [
  { name: 'environment', access: 'read' },
  { name: 'inventory_projects', access: 'read' },
  { name: 'inventory_projects', access: 'write' },
  { name: 'project_worktrees', access: 'write' },
  { name: 'worktrees', access: 'read' },
  { name: 'worktrees', access: 'write' },
];

/** The action UI's status: 8 processes on a branch, 6 on detached HEAD. */
const GIT_STATUS: string[] = [
  'rev-parse --absolute-git-dir; rev-parse --git-common-dir (verifyCheckout, once per request)',
  'config --null --list; ls-files -z; check-attr -z --stdin filter over every tracked path (paid per request, never cached)',
  'status --porcelain=v2 -z --branch --ahead-behind --untracked-files=all --find-renames=50%',
  'for-each-ref refs/heads/ (upstream; only on a branch)',
  'stash list -100 (only on a branch)',
];

const STATUS_STEPS: Step[] = [
  s(
    'use-case',
    'resolveInspectionWorktree',
    `Reads the whole inventory from SQLite and requires an available worktree with a metadata identity.`,
    caseFile('resolve-inspection-worktree.ts'),
    5,
  ),
  s(
    'git',
    'InspectionGit.readStatus',
    `Verifies the checkout once for the request, then reads.`,
    git('inspection-git.ts'),
    24,
  ),
  s(
    'git',
    'verifyCheckout',
    `Runs rev-parse for the worktree and common Git directories and compares device, inode and birth time with the stored identity.`,
    git('commands/verify-checkout.ts'),
    5,
  ),
  s(
    'git',
    'checkConversionFilters',
    `Reads Git config, lists every tracked path and pipes all of them to check-attr. Paid per request rather than cached: a cached "no filters" answer is permission to run a filter someone configured in between.`,
    git('commands/check-conversion-filters.ts'),
    4,
  ),
  s(
    'git',
    'readStatus',
    `Runs porcelain v2 status, and nothing else: the upstream name and stash list are their own read.`,
    git('commands/read-status.ts'),
    6,
  ),
];

/** Git.listWorktrees used as an identity check: 2 processes, whatever W is. */
const readableGit = (when: string): string[] => [
  `rev-parse --git-common-dir (listWorktrees from a checkout, ${when})`,
  `worktree list --porcelain -z (${when})`,
];

const readableStep = (when: string, path: string, line: number): Step =>
  s(
    'git',
    'resolveReadableWorktree',
    `Lists every worktree of the repository with Git and re-derives identities ${when} the filesystem work.`,
    path,
    line,
  );

const operationsStep = (what: string): Step =>
  s('runner', 'Lanes.run (repository lane)', what, RUNNER, 37);

// ---------------------------------------------------------------------------
// connection
// ---------------------------------------------------------------------------

const connection: Area = {
  id: 'connection',
  title: 'Connection and auth',
  webSurface: `A pairing link at /pair and session restore on page reload. Every browser request carries the device cookie; the x-porcelain-browser header is sent too but only disconnect requires it. There is no Disconnect control in the app: DELETE /api/session exists and nothing calls it.`,
  summary: `One kind of credential answers here: a device credential the device redeemed for itself. There is no shared token and no way to name a principal in a request, so every authenticated caller is the viewer its device belongs to. A browser holds that credential as an HttpOnly cookie and sends nothing else; anything without a cookie jar sends the same credential as a bearer. Device digests live in memory, so authentication adds no SQL, and revoking takes effect on the next request and on anything the device is holding open. Every route is registered once under /api; /health and POST /api/pair are the only public ones, and pair carries its own attempt limit. Before authentication, one hook validates the Host header and rejects a foreign Origin on unsafe methods, and every request carries a principal from the door it arrived through — anonymous until a credential upgrades it.`,
  flows: [
    {
      id: 'connection.pair',
      title: 'Redeem a pairing link',
      endpoint: {
        method: 'POST',
        path: '/api/pair',
        source: at('apps/server/src/http/routes/pair.ts', 27),
      },
      webTriggers: [],
      steps: [
        s(
          'route',
          'AttemptLimit.take',
          `A shared ceiling spent before a per-peer bucket. Entropy makes guessing hopeless; this bounds a flood of valid-shaped codes forcing hashes and SQLite reads on the shared event loop, and rotating source addresses buys nothing.`,
          'apps/server/src/http/routes/attempt-limit.ts',
          24,
        ),
        s(
          'use-case',
          'Pairing.redeem',
          `Parses the code, mints a device credential, and hands both to the store. One message covers expired, consumed, revoked and wrong, so nothing is an oracle.`,
          'apps/server/src/use-cases/pairing.ts',
          97,
        ),
        s(
          'repository',
          'PairingRepository.redeem',
          `One immediate transaction: the conditional update and the device insert.`,
          'apps/server/src/repositories/pairing-repository.ts',
          78,
        ),
        s(
          'route',
          'setDeviceCookie',
          `A browser gets an HttpOnly cookie and no credential in the body; anything else gets the credential and no cookie. Every later cookie request renews the 90-day window, because refreshing only after an idle gap would still expire a browser used hourly.`,
          'apps/server/src/http/middlewares/device-cookie.ts',
          18,
        ),
      ],
      runner: 'none',
      gitCommands: [],
      tables: [
        { name: 'pairing_grants', access: 'write' },
        { name: 'devices', access: 'write' },
      ],
      cost: 'One hash and one indexed read; it enters no lane.',
      notes:
        'The only unauthenticated write on the network door. The code arrives in the body because the link carries it in the fragment, which browsers never send.',
    },
    {
      id: 'connection.owner-access',
      title: 'Issue, list and revoke access (owner socket only)',
      webTriggers: [],
      steps: [
        s(
          'route',
          'POST /pairings',
          `One link per label, because the owner pairs several devices at a time. At least one origin is required, and each is judged by the same host rule the request hook applies, so a server bound to every interface cannot answer at an address that pairing then refuses. The port must be the one bound, because a link is a promise the device can reach this server. The link carries the environment id so a client can refuse one meant for another installation. The link is printed, never taken as an argument.`,
          'apps/server/src/http/owner-routes.ts',
          25,
        ),
        s(
          'route',
          'GET /access',
          `Pending links and paired devices: label, platform, last seen, address.`,
          'apps/server/src/http/owner-routes.ts',
          47,
        ),
        s(
          'route',
          'POST /access/revoke',
          `One id revokes either a pending link or a device.`,
          'apps/server/src/http/owner-routes.ts',
          56,
        ),
        s(
          'runner',
          'DeviceDirectory.revoke',
          `Persists, then marks the cached entry, then closes whatever the device holds open.`,
          'apps/server/src/lifecycle/device-directory.ts',
          136,
        ),
      ],
      runner: 'none',
      gitCommands: [],
      tables: [
        { name: 'pairing_grants', access: 'write' },
        { name: 'devices', access: 'write' },
      ],
      cost: 'Constant; the listing is two indexed reads.',
      notes:
        'Unreachable over the network by construction: these routes exist only on the Unix socket listener, so a leaked device credential cannot pair or revoke.',
    },
    {
      id: 'connection.authenticate',
      title: 'Authenticate a request (bearer or browser cookie)',
      webTriggers: [
        wt(
          'browserTransport',
          web('api/session/live.ts'),
          5,
          `Wraps every browser request: adds x-porcelain-browser: 1, strips the placeholder bearer and sends same-origin cookies.`,
        ),
      ],
      steps: [
        s(
          'route',
          'authenticate (onRequest hook)',
          `Each route group installs the hook; it runs before body parsing and before the application is touched.`,
          'apps/server/src/http/middlewares/authenticate.ts',
          6,
        ),
        s(
          'route',
          'credentialOf',
          `A Bearer header if there is one, otherwise the single porcelain_device cookie. The browser is cookie-only; a client with no cookie jar sends the same credential as a bearer.`,
          'apps/server/src/http/middlewares/device-cookie.ts',
          8,
        ),
        s(
          'application',
          'DeviceDirectory.authenticate',
          `Resolves the credential against an in-memory digest map. Unknown, wrong, revoked and dormant are one answer, so nothing here is an oracle.`,
          'apps/server/src/lifecycle/device-directory.ts',
          70,
        ),
        s(
          'route',
          'setDeviceCookie (refresh)',
          `A cookie request renews its 90-day window on every use, so a browser in constant use is never logged out by age.`,
          'apps/server/src/http/middlewares/device-cookie.ts',
          18,
        ),
      ],
      runner: 'none',
      gitCommands: [],
      tables: [],
      cost: 'Constant: one hash comparison per request, no SQL.',
      notes: `There is no principal a request can ask for. The agent principal exists only on the owner socket, so nothing replayed here can become one.`,
    },
    {
      id: 'connection.session',
      title: 'Restore browser session',
      endpoint: {
        method: 'GET',
        path: '/api/session',
        source: at(route('browser-session.ts'), 16),
      },
      webTriggers: [
        wt(
          'WorkspaceProvider restore effect',
          web('query/workspace-provider.tsx'),
          151,
          `Once on app mount (skipped with the playground bridge), 15 s timeout. Success seeds the inventory cache and immediately invalidates it (workspace-provider.tsx:103), which lists again.`,
        ),
      ],
      steps: [
        s(
          'route',
          'browserSessionRoutes GET /api/session',
          `Authenticates, disables caching and maps the stored inventory.`,
          route('browser-session.ts'),
          15,
        ),
        s(
          'application',
          'Application.inventory',
          `Checks the application is open and reads SQLite directly, without queueing.`,
          APP,
          433,
        ),
        s(
          'repository',
          'InventoryRepository.read',
          `Reads environment, projects and worktrees in one transaction.`,
          repo('inventory-repository.ts'),
          24,
        ),
      ],
      runner: 'none',
      gitCommands: [],
      tables: INVENTORY_READ,
      cost: 'Three selects; grows with projects and worktrees. No Git.',
    },
    {
      id: 'connection.logout',
      title: 'Clear browser session',
      endpoint: {
        method: 'DELETE',
        path: '/api/session',
        source: at(route('browser-session.ts'), 27),
      },
      webTriggers: [
        wt(
          'WorkspaceProvider.disconnect',
          web('query/workspace-provider.tsx'),
          112,
          `Would save open file drafts, abort the connection and clear the cache — but no view calls it, so this route is currently unreachable from the app.`,
        ),
      ],
      steps: [
        s(
          'route',
          'DELETE /api/session',
          `Requires only the browser header, then expires the cookie.`,
          route('browser-session.ts'),
          28,
        ),
        s(
          'route',
          'clearDeviceCookie',
          `Sets porcelain_device with Max-Age=0.`,
          'apps/server/src/http/middlewares/device-cookie.ts',
          35,
        ),
      ],
      runner: 'none',
      gitCommands: [],
      tables: [],
      cost: 'Constant.',
      notes: `Not authenticated, and it does not revoke: it takes the credential away from this browser only. The owner revokes the device itself with porcelain revoke.`,
    },
    {
      id: 'connection.health',
      title: 'Health check',
      endpoint: {
        method: 'GET',
        path: '/api/health',
        source: at(route('health.ts'), 7),
      },
      webTriggers: [],
      steps: [
        s(
          'route',
          'healthRoute',
          `Returns { status: 'ok' } without touching the application.`,
          route('health.ts'),
          6,
        ),
      ],
      runner: 'none',
      gitCommands: [],
      tables: [],
      cost: 'Constant.',
      notes: `Public. Proves the process listens and the application opened, not that repositories are reachable.`,
    },
    {
      id: 'connection.static-web',
      title: 'Serve the built web app',
      webTriggers: [
        wt(
          'browser page load',
          web('main.tsx'),
          1,
          `Only when the server runs with PORCELAIN_WEB_ROOT; development uses the Vite proxy instead.`,
        ),
      ],
      steps: [
        s(
          'route',
          'registerStaticFiles',
          `GET/HEAD on /* resolves a file under the web root, with SPA fallback; hashed Vite assets are immutable, everything else no-cache.`,
          'apps/server/src/http/static-files.ts',
          195,
        ),
      ],
      runner: 'none',
      gitCommands: [],
      tables: [],
      cost: 'Per asset request: path checks and one file stream.',
    },
  ],
  decisions: [
    {
      title: 'One bearer token, one trusted principal',
      summary: `A local companion server needs the simplest credential that still keeps other local users and LAN hosts out. Possession of the token lets a caller register any checkout the server can read; pairing, rotation UX and per-user identity are deferred.`,
      doc: doc('0004-inventory-http.md'),
    },
    {
      title: 'Browser cookie derived from the token',
      summary: `The token never lives in browser storage; the cookie is HMAC-signed with the server token, so sessions survive restarts and token rotation invalidates them. Tradeoffs: no server-side revocation, no Secure flag on LAN HTTP, and cookies are host-scoped rather than port-scoped. Cookie use requires a custom header, which blocks cross-origin requests without CORS.`,
      doc: doc('browser-inventory.md'),
    },
    {
      title:
        'Query hooks own server state; the connection owns credentials and cancellation',
      summary: `Views never call the API; query hooks bind the credential, the connection abort and a 15 s deadline into one request envelope. This keeps IO out of views, but it also hides how many server operations a view actually starts.`,
      doc: doc('web-client-layers.md'),
    },
    {
      title: 'Vite SPA, optionally hosted by the server',
      summary: `A React and Vite app shared with the future Electron renderer; the server can host the built assets on the same origin as /api, which avoids CORS. The Query client created here sets the refetch defaults that every area inherits.`,
      doc: doc('web-foundation.md'),
    },
    {
      title: 'Routes exist once, under /api',
      summary: `One prefix for browsers, agents and tests, matching the cookie path. The alternative, keeping bare paths as an alias, would have preserved two route tables and auth code that special-cases both spellings.`,
      source: at('apps/server/src/http/server.ts', 132),
    },
    {
      title: 'Pairing links are single use, and consumed in one statement',
      summary: `Redemption is one immediate transaction: a conditional update carrying every predicate — unredeemed, unrevoked, unexpired, not created in the future — and the device insert. Two redeemers cannot both see one row change, and a failure after the update rolls the consumption back rather than burning the owner's link.`,
      source: at('apps/server/src/repositories/pairing-repository.ts', 78),
    },
    {
      title: 'Device credentials are bearer tokens, hashed at rest',
      summary: `\`pcd_<id>_<secret>\`: the id makes the lookup one map read and the 256-bit secret is compared as a digest in constant time. A bare secret would force a scan comparing every stored digest. No DPoP or device-bound keys — the LAN is trusted and remote access is already encrypted — so a stolen credential is that device until it is revoked.`,
      source: at('apps/server/src/models/credential.ts', 16),
    },
    {
      title: 'One host rule, and one reachability rule built on it',
      summary: `The request hook asks whether a name is acceptable on a connection that already arrived; pairing asks whether a device could open one. They share canonicalisation and the allowed-host set, and they were written separately once and disagreed under \`--lan\` in both directions — the door served a LAN address pairing refused, and pairing offered \`[::1]\` on an IPv4-only bind that the door cannot answer. Reachability is therefore the stricter of the two: the port must be the bound one, and loopback has to actually be listening.`,
      source: at('apps/server/src/models/origin-policy.ts', 62),
    },
    {
      title: 'The device cache is what makes revocation immediate',
      summary: `The review forbids per-request SQL, so digests are held in memory and every write goes through the directory. That is only safe because one server owns a data directory: there is no second writer to miss. Revocation persists first, then marks the entry, then cuts live connections; the last-seen flush writes only two fields and never to a revoked row, so a dirty entry cannot resurrect a credential.`,
      source: at('apps/server/src/lifecycle/device-directory.ts', 36),
    },
    {
      title: 'The door decides the principal, and it is never absent',
      summary: `The network hook assigns an anonymous principal before anything reads the request; authentication upgrades it to a viewer, and the MCP door to an agent. Routes convert it to an authenticated caller or fail closed, so a use case cannot receive a caller that was never identified.`,
      source: at('apps/server/src/http/principal.ts', 11),
    },
  ],
  observations: [
    {
      kind: 'good',
      title: 'Routes exist once, at /api',
      detail: `registerApiRoutes runs inside a single /api prefix. The device cookie's path is /api, so it covers every route and nothing else on the origin.`,
      sources: [
        at('apps/server/src/http/server.ts', 131),
        at('apps/server/src/http/middlewares/authenticate.ts', 25),
        at('apps/server/src/http/middlewares/device-cookie.ts', 18),
      ],
      confidence: 'verified',
    },
    {
      kind: 'good',
      title: 'Disconnect is not revocation, and revocation is real',
      detail: `Disconnect expires this browser's cookie; the device stays paired. A copied cookie is a copied device credential, and the owner ends it with porcelain revoke — which marks the row, drops the in-memory digest and destroys whatever that device is holding open.`,
      sources: [
        at('apps/server/src/lifecycle/device-directory.ts', 113),
        at('apps/server/src/http/middlewares/authenticate.ts', 44),
      ],
      confidence: 'verified',
    },
    {
      kind: 'good',
      title: 'Browser credential never reaches JavaScript storage',
      detail: `HttpOnly, SameSite=Strict and scoped to /api. The pairing code that bought it arrives in the URL fragment, which browsers never send, and the web erases that fragment before it renders anything.`,
      sources: [
        at('apps/server/src/http/middlewares/device-cookie.ts', 18),
        at('apps/web/src/api/pairing/link.ts', 18),
      ],
      confidence: 'verified',
    },
  ],
};

// ---------------------------------------------------------------------------
// inventory
// ---------------------------------------------------------------------------

const LIST_WORKTREES_GIT = [
  'rev-parse --path-format=absolute --git-common-dir',
  'worktree list --porcelain -z',
  // Identity per worktree comes from the repository's own registry: a stat
  // and two small file reads, no Git process.
];

const inventory: Area = {
  id: 'inventory',
  title: 'Projects and worktrees',
  webSurface: `Left sidebar: projects and worktrees with a status dot each, the add-project dialog (suggestions and folder picker), Rename project and Remove project.`,
  summary: `Projects are SQLite rows; worktrees are not stored at all. Every inventory request lists them from Git and derives each id from the project and the filesystem identity of the worktree's administrative directory, so the same checkout keeps its id across moves and restarts without anything being written down. Resolution is an in-memory map, and worktree_presence records only how long a worktree has been gone. Each worktree also carries what the sidebar has to say about it — pending, reviewed or replied — read for all of them in one statement with the list, so the sidebar costs no request of its own and no Git.`,
  flows: [
    {
      id: 'inventory.list',
      title: 'List worktrees from Git',
      endpoint: {
        method: 'GET',
        path: '/api/inventory',
        source: at(route('get-inventory.ts'), 12),
      },
      webTriggers: [
        wt(
          'useInventory',
          web('query/inventory.ts'),
          64,
          `Mount, window focus and reconnect. There is no separate refresh to ask for: reading the inventory is the listing.`,
        ),
      ],
      steps: [
        s(
          'route',
          'getInventoryRoute',
          `Returns environment, projects and the worktrees Git lists right now.`,
          route('get-inventory.ts'),
          19,
        ),
        s(
          'application',
          'listProjects',
          `One coalesced \`git worktree list\` per project, on the inventory lane. A registered project brings its own common directory, so nothing has to go and find it first.`,
          APP,
          148,
        ),
        s(
          'application',
          'WorktreeDirectory.list',
          `Reads the repository's own worktree registry and stats each administrative directory for its identity: one Git process per project, none per worktree.`,
          'apps/server/src/lifecycle/worktree-directory.ts',
          80,
        ),
        s(
          'application',
          'deriveWorktreeId',
          `The id is a hash of the project and that identity, so it survives a restart and a move and changes when a worktree is recreated.`,
          'apps/server/src/models/worktree-id.ts',
          25,
        ),
        s(
          'repository',
          'WorktreePresenceRepository.observe',
          `A listing that succeeded is the only thing allowed to say a worktree is missing; that starts the thirty-day clock.`,
          repo('worktree-presence-repository.ts'),
          44,
        ),
      ],
      runner: 'operations',
      gitCommands: ['worktree list --porcelain -z (per project)'],
      tables: [
        { name: 'environment', access: 'read' },
        { name: 'projects', access: 'read' },
        { name: 'projects', access: 'write' },
        { name: 'worktree_presence', access: 'read' },
        { name: 'worktree_presence', access: 'write' },
      ],
      cost: 'One Git process per project, plus one stat per worktree. Nothing per worktree from Git.',
    },
    {
      id: 'inventory.register',
      title: 'Register a project',
      endpoint: {
        method: 'POST',
        path: '/api/projects',
        source: at(route('register-project.ts'), 17),
      },
      webTriggers: [
        wt(
          'useRegisterProject',
          web('query/inventory.ts'),
          75,
          `On add-project submit. Cancels in-flight inventory queries before the write and again before patching the cache with the returned project.`,
        ),
      ],
      steps: [
        s(
          'route',
          'registerProjectRoute',
          `Requires an absolute server-side path.`,
          route('register-project.ts'),
          16,
        ),
        s(
          'application',
          'Application.register',
          `Queues on operations.`,
          APP,
          437,
        ),
        operationsStep(`Serialized with every other main-queue operation.`),
        s(
          'use-case',
          'RegisterProject.execute',
          `Discovers the repository at the path.`,
          caseFile('register-project.ts'),
          21,
        ),
        s(
          'git',
          'Git.listWorktrees',
          `Reads identity and all worktrees of the target repository.`,
          git('commands/list-worktrees.ts'),
          56,
        ),
        s(
          'use-case',
          'RegisterProject.execute (overlapping only)',
          `Re-lists only the projects that claim one of this repository's checkout paths, so a stale claim cannot block the registration.`,
          caseFile('register-project.ts'),
          31,
        ),
        s(
          'repository',
          'InventoryRepository.save',
          `Keeps the id and name of any project with the same repository identity, and saves the project alone: its worktrees come from the listing in the same reply.`,
          repo('inventory-repository.ts'),
          60,
        ),
      ],
      runner: 'operations',
      gitCommands: [
        ...LIST_WORKTREES_GIT.map((command) => `${command} (new repository)`),
        'listWorktrees (2) for each overlapping old project',
      ],
      tables: INVENTORY_WRITE,
      cost: 'Two Git processes for the new repository, plus two per overlapping project, whatever their worktree counts.',
    },
    {
      id: 'inventory.discover',
      title: 'Suggest nearby repositories',
      endpoint: {
        method: 'GET',
        path: '/api/projects/discover',
        source: at(route('project-locations.ts'), 18),
      },
      webTriggers: [
        wt(
          'useProjectDiscovery',
          web('query/project-locations.ts'),
          5,
          `When the add-project suggestions mount (project-discovery.tsx:22). staleTime 60 s, but the global focus policy 'always' still refetches on every focus while mounted.`,
        ),
      ],
      steps: [
        s(
          'route',
          'readUntilClosed',
          `Aborts the work when the HTTP client disconnects.`,
          route('project-locations.ts'),
          46,
        ),
        s(
          'application',
          'Application.discoverProjects',
          `Runs on the discovery queue, not the main one.`,
          APP,
          423,
        ),
        s(
          'runner',
          'Lanes.run (filesystem lane)',
          `Single-lane queue for discovery only.`,
          RUNNER,
          37,
        ),
        s(
          'use-case',
          'FindProjects.discover',
          `Breadth-first walk from home and parents of known worktrees.`,
          caseFile('find-projects.ts'),
          66,
        ),
        s(
          'filesystem',
          'NodeProjectFolders.read',
          `realpath + opendir; up to 2000 entries per folder.`,
          fsys('project-folders.ts'),
          12,
        ),
        s(
          'git',
          'Git.listWorktrees',
          `Runs only for folders with a .git marker.`,
          caseFile('find-projects.ts'),
          44,
        ),
      ],
      runner: 'discovery',
      gitCommands: ['listWorktrees (2) per folder with a .git marker'],
      tables: INVENTORY_READ,
      cost: 'Bounded: at most 500 folders, depth 3, 50 repositories; one listWorktrees per repository found.',
    },
    {
      id: 'inventory.folders',
      title: 'Browse server folders',
      endpoint: {
        method: 'GET',
        path: '/api/projects/folders',
        source: at(route('project-locations.ts'), 30),
      },
      webTriggers: [
        wt(
          'useProjectFolder',
          web('query/project-locations.ts'),
          16,
          `While the folder picker is expanded (project-folder-picker.tsx:36); one query per browsed path; refetched on every focus while mounted.`,
        ),
      ],
      steps: [
        s(
          'route',
          'readUntilClosed',
          `Aborts when the client disconnects.`,
          route('project-locations.ts'),
          46,
        ),
        s(
          'application',
          'Application.browseProjectFolders',
          `Runs on the browsing queue.`,
          APP,
          428,
        ),
        s(
          'runner',
          'Lanes.run (filesystem lane)',
          `Single-lane queue for folder browsing.`,
          RUNNER,
          37,
        ),
        s(
          'use-case',
          'FindProjects.browse',
          `Reads one folder and checks whether it is a repository.`,
          caseFile('find-projects.ts'),
          54,
        ),
        s(
          'filesystem',
          'NodeProjectFolders.read',
          `opendir with a 2000-entry cap and a stat per symlink.`,
          fsys('project-folders.ts'),
          12,
        ),
      ],
      runner: 'browsing',
      gitCommands: [
        'listWorktrees (2), only when the folder has a .git marker',
      ],
      tables: [],
      cost: 'One opendir per request; Git only for repository folders.',
    },
    {
      id: 'inventory.remove',
      title: 'Remove a project',
      endpoint: {
        method: 'DELETE',
        path: '/api/projects/:projectId',
        source: at(route('remove-project.ts'), 16),
      },
      webTriggers: [
        wt(
          'useRemoveProject',
          web('query/inventory.ts'),
          117,
          `On confirm. Saves open drafts of the project first, then drops the project from the cached inventory and removes its review queries.`,
        ),
      ],
      steps: [
        s(
          'route',
          'removeProject',
          `Validates the project ID.`,
          route('remove-project.ts'),
          15,
        ),
        s(
          'application',
          'Application.removeProject',
          `Queues on operations after the in-memory block check.`,
          APP,
          418,
        ),
        s(
          'application',
          'GitActionCoordinator.assertProjectRemovable',
          `Rejects projects blocked in memory by an unconfirmed Git process group.`,
          COORDINATOR,
          33,
        ),
        operationsStep(`An active operation must finish first.`),
        s(
          'repository',
          'ProjectRemovalRepository.remove',
          `One immediate transaction: rejects running or indeterminate receipts and blocks, then deletes all review data of the project.`,
          repo('project-removal-repository.ts'),
          22,
        ),
      ],
      runner: 'operations',
      gitCommands: [],
      tables: [
        { name: 'inventory_projects', access: 'read' },
        { name: 'git_action_blocks', access: 'read' },
        { name: 'git_action_receipts', access: 'read' },
        { name: 'project_worktrees', access: 'read' },
        { name: 'artifacts', access: 'write' },
        { name: 'comment_threads', access: 'write' },
        { name: 'project_file_preferences', access: 'write' },
        { name: 'commit_review_layer_sets', access: 'write' },
        { name: 'review_layer_sets', access: 'write' },
        { name: 'reviewed_files', access: 'write' },
        { name: 'git_action_preparations', access: 'write' },
        { name: 'git_action_receipts', access: 'write' },
        { name: 'inventory_projects', access: 'write' },
      ],
      cost: 'One transaction; parses the JSON of every receipt of the project. Never touches the checkout.',
    },
    {
      id: 'inventory.status',
      title: 'The sidebar dot, with the worktree list',
      endpoint: {
        method: 'GET',
        path: '/api/inventory',
        source: at(route('get-inventory.ts'), 12),
      },
      webTriggers: [
        wt(
          'ProjectNavigator',
          web('views/workspace/project-navigator.tsx'),
          246,
          `One dot per worktree, read from the list the sidebar already has. The server names the state; the fill and the hue are the web's. There is no request of its own and no Git: the count it replaced cost a status read per worktree, or a full evidence read once anything was marked.`,
        ),
      ],
      steps: [
        s(
          'application',
          'WorktreeStatusRepository.status',
          `One statement for every worktree of every project: published layers (and whether every file they name is marked), and threads whose last word is the agent's and is newer than what the owner acknowledged.`,
          repo('worktree-status-repository.ts'),
          23,
        ),
        s(
          'use-case',
          'MarkCommentsSeen.execute',
          `The owner says how far they read, carrying a revision from the snapshot they saw. Listing the discussion does not count: the index prefetches it.`,
          caseFile('mark-comments-seen.ts'),
          22,
        ),
      ],
      runner: 'none',
      gitCommands: [],
      tables: [
        { name: 'review_layer_sets', access: 'read' },
        { name: 'comment_threads', access: 'read' },
        { name: 'comment_reads', access: 'read' },
        { name: 'comment_reads', access: 'write' },
      ],
      cost: 'One SQLite statement for the whole sidebar, whatever the worktree count.',
    },
  ],
  decisions: [
    {
      title: 'Identity by filesystem evidence, not paths',
      summary: `Projects and worktrees get Porcelain IDs matched by device, inode and birth time of their Git directories, so ordinary moves keep identity and recreated metadata does not. The price: filesystems without birth time are unsupported, and every read re-checks identity, which is part of the per-request Git cost.`,
      doc: doc('0002-environment-inventory.md'),
    },
    {
      title: 'Relational inventory replaced transactionally',
      summary: `Drizzle tables with explicit order; a refresh replaces a project's worktree rows in one transaction. Because worktree rows are transient, every other store keys by worktree ID without foreign keys and needs its own notion of existence.`,
      doc: doc('0003-drizzle-and-fastify.md'),
    },
    {
      title: 'GET is a snapshot, POST refresh rescans',
      summary: `An explicit split keeps inventory reads cheap; discovery and browsing run independently of writes and cancel on disconnect. The web now uses POST refresh for every query run, so the cheap path is used only at login.`,
      doc: doc('0004-inventory-http.md'),
    },
    {
      title: 'Browser keeps the last inventory when refresh fails',
      summary: `A failed refresh keeps the previous snapshot with a stale warning, and unavailable entries stay visible. The document still describes refresh as a manual action; code has since made it automatic on focus.`,
      doc: doc('browser-inventory.md'),
    },
    {
      title: 'Explicit removal forgets review data but keeps recovery evidence',
      summary: `Removal deletes all private data of a project in one transaction and never touches the checkout. Running or indeterminate receipts block removal so recovery evidence cannot be discarded; a quarantined project can be neither used for Git actions nor removed.`,
      doc: doc('project-removal.md'),
    },
    {
      title: 'Listing on every query run',
      summary: `Focus and reconnect are treated as the natural moment to discover new worktrees, so the inventory query lists again. A focus costs one Git process per project, in parallel, each with its own deadline.`,
      source: at(web('query/inventory.ts'), 62),
    },
    {
      title: 'A dot the database can answer, not a count Git has to',
      summary: `The sidebar says what each worktree has to say for itself — \`pending\` (published layers with something unreviewed), \`reviewed\` (all of them marked, waiting for a commit) or \`replied\` (an answer you have not read, which wins) — instead of how many files are pending. The server names the state and the web draws it, so the palette is not in the API. It is one SQLite statement for every worktree, sent with the list, so the sidebar costs no Git at all. The price: "how much is left" is no longer visible until you open the worktree, and \`reviewed\` means "everything marked, as of when it was marked" — it cannot see the agent editing a file that was already marked until step 6's watcher exists.`,
      source: at(repo('worktree-status-repository.ts'), 23),
    },
  ],
  observations: [
    {
      kind: 'good',
      title: 'A window focus costs one Git process per project',
      detail: `refetchOnWindowFocus 'always' still means each alt-tab lists again, but listing is one \`git worktree list\` per project and a stat per worktree — no per-worktree Git, and no rows rewritten, because no table copies Git's list.`,
      sources: [
        at(web('query/client.ts'), 12),
        at(web('query/inventory.ts'), 64),
        at('apps/server/src/lifecycle/worktree-directory.ts', 80),
      ],
      confidence: 'verified',
    },
    {
      kind: 'good',
      title: 'The sidebar costs one statement, whatever its size',
      detail: `Both dot states are read for every worktree at once, with the list: live layers, and threads whose last word is the agent's and is newer than what the owner acknowledged. Ten worktrees cost the same as one, and no Git runs.`,
      sources: [
        at(repo('worktree-status-repository.ts'), 23),
        at(APP, 168),
        at(web('views/workspace/project-navigator.tsx'), 246),
      ],
      confidence: 'verified',
    },
    {
      kind: 'good',
      title: 'A hanging repository costs only its own wait',
      detail: `Projects are listed together, four Git processes at a time, and each project's listing has five seconds of its own. A mount that has stopped answering is reported unavailable with its last-known worktrees while the others answer, and the request's deadline covers every wave rather than one fixed window.`,
      sources: [
        at('apps/server/src/lifecycle/worktree-directory.ts', 130),
        at('apps/server/src/lifecycle/launch-limit.ts', 33),
        at(APP, 214),
      ],
      confidence: 'verified',
    },
    {
      kind: 'correctness',
      title: 'Project name can be the wrong folder',
      detail: `A new project is named basename(dirname(commonDirectory)). That is the checkout folder only when the Git directory is checkout/.git; with a separate git dir the name is whatever folder contains the Git directory. Naming from the origin remote is step 4b.`,
      sources: [at(caseFile('register-project.ts'), 51)],
      confidence: 'likely',
    },
    {
      kind: 'good',
      title: 'Registration and discovery are scoped',
      detail: `Registering re-lists only projects whose paths overlap the new repository; discovery is bounded (500 folders, depth 3, 50 repos), runs on its own queue and cancels when the client leaves.`,
      sources: [
        at(caseFile('register-project.ts'), 29),
        at(caseFile('find-projects.ts'), 81),
        at(route('project-locations.ts'), 46),
      ],
      confidence: 'verified',
    },
  ],
};

// ---------------------------------------------------------------------------
// changes
// ---------------------------------------------------------------------------

/** The change list: 6 processes, whatever N is. */
const CHANGES_GIT: string[] = [
  'rev-parse --absolute-git-dir; rev-parse --git-common-dir (verifyCheckout, once per request)',
  'config --null --list; ls-files -z; check-attr -z --stdin filter over every tracked path (paid per request, never cached)',
  'status --porcelain=v2 -z --branch --ahead-behind --untracked-files=all --find-renames=50%',
  '[only when a submodule pointer moved] submodule status -- <paths>',
];

/** The hunks of the files a reader opened: 7, whatever the layer holds. */
const DIFFS_GIT: string[] = [
  'rev-parse --absolute-git-dir; rev-parse --git-common-dir (verifyCheckout, once per request)',
  'config --null --list; ls-files -z; check-attr -z --stdin filter (unstaged selections only)',
  'status --porcelain=v2 (the observation and fingerprints the request is checked against)',
  'diff [--cached] --raw -z --patch --no-ext-diff --no-textconv -- <exact pathspecs>, once per scope',
  'status --porcelain=v2 again, to bind the hunks to the fingerprints returned with them',
];

const changes: Area = {
  id: 'changes',
  title: 'Changes and review evidence',
  webSurface: `Changes tab and review index: changed files with diffs, reviewed checkboxes, Mark all reviewed, and the Git button's branch and ahead/behind state.`,
  summary: `Status and evidence are read-only Git inspections that verify checkout identity and conversion filters before and after each read. Evidence reads status, diffs every staged and unstaged file (8 at a time, one guard pair per batch of 64), reads untracked files, then reads status again; the result is cached per worktree by status token plus file stamps. The web loads status and full evidence (every patch, up to 16 MiB) when a worktree opens and again on every window focus. Reviewed marks store an evidence fingerprint per path; setting one re-reads evidence for that path.`,
  flows: [
    {
      id: 'changes.status',
      title: 'Read the status an action needs',
      endpoint: {
        method: 'GET',
        path: '/api/worktrees/:worktreeId/git/status',
        source: at(route('read-git-status.ts'), 17),
      },
      webTriggers: [
        wt(
          'useGitStatus',
          web('query/review.ts'),
          321,
          `Only the action panel, and only when it opens: RemoteActionForm (views/review/git-action-inspection.tsx:59) fills its remote, ref and stash fields from it. Nothing on the review surface reads this.`,
        ),
      ],
      steps: [
        s(
          'route',
          'readGitStatus',
          `Maps the observation to the public status contract.`,
          route('read-git-status.ts'),
          16,
        ),
        s(
          'application',
          'Application.gitStatus',
          `Queues on the repository lane.`,
          APP,
          565,
        ),
        operationsStep(
          `Waits behind every earlier read or write of this repository.`,
        ),
        s(
          'use-case',
          'ReadWorktreeStatus.execute',
          `Reads status, then the branch details — skipped entirely on a detached HEAD.`,
          caseFile('read-worktree-status.ts'),
          28,
        ),
        ...STATUS_STEPS,
        s(
          'git',
          'readBranchDetails',
          `for-each-ref for the upstream and the stash list: two processes that say nothing about what changed, which is why they are not part of reading the list.`,
          git('commands/read-status.ts'),
          37,
        ),
      ],
      runner: 'operations',
      gitCommands: GIT_STATUS,
      tables: INVENTORY_READ,
      cost: `8 Git processes on a branch, 6 on detached HEAD. The filter check lists and attribute-checks every tracked path, so cost grows with repository size, not with changes.`,
    },
    {
      id: 'changes.list',
      title: 'Read what changed',
      endpoint: {
        method: 'GET',
        path: '/api/worktrees/:worktreeId/changes',
        source: at(route('read-changes.ts'), 28),
      },
      webTriggers: [
        wt(
          'useChangesOptions',
          web('query/review.ts'),
          101,
          `One shared query per worktree behind useChanges, useReviewOverview, useHasReviewLayers, useReviewChanges and usePrefetchReview, mounted by review-workspace (275), git-button (50), file-navigation (80), review-index (71) and the Changes documents (documents.tsx:100). Each run also fetches review layers in parallel (packages/client/src/review.ts). ${FOCUS} Invalidated by file edits (whole worktree) and by Git receipts that need refresh (whole project).`,
        ),
        wt(
          'useReviewChanges',
          web('query/review.ts'),
          232,
          `Merges the list with the reviewed marks and narrows it to the paths a document shows; read by the review index (review-index.tsx:73), Changes documents (documents.tsx:101, 162, 205) and code documents (review-code-document.tsx:45).`,
        ),
      ],
      steps: [
        s(
          'route',
          'changeRoutes GET changes',
          `Carries the request's disconnect signal.`,
          route('read-changes.ts'),
          28,
        ),
        s(
          'application',
          'Application.changes',
          `Queues on the repository lane.`,
          APP,
          582,
        ),
        operationsStep(
          `Waits behind every earlier read or write of this repository.`,
        ),
        s(
          'use-case',
          'ReadWorktreeChanges.execute',
          `Reads status once, groups the comparisons by logical path and fingerprints each.`,
          caseFile('read-worktree-changes.ts'),
          50,
        ),
        s(
          'filesystem',
          'readWorktreeFiles',
          `Digests every working path with a side to establish, eight at a time, through the no-follow boundary: ancestors checked before and after, the handle re-stat'd against what was classified, and a symlink answered from its own target rather than followed.`,
          fsys('worktree-files.ts'),
          27,
        ),
        s(
          'git',
          'readSubmoduleHeads',
          `Only when a submodule pointer moved in the worktree: the status prints the same gitlink on both sides, and a directory cannot be digested.`,
          git('commands/read-submodule-heads.ts'),
          16,
        ),
        s(
          'use-case',
          'fingerprintChange',
          `One fingerprint per path over all of its comparisons, modes included; null only when a side could not be established at all.`,
          caseFile('fingerprint-change.ts'),
          31,
        ),
        s(
          'use-case',
          'ResolveWorktree.reachable',
          `The answer is about to leave the process, so the checkout is confirmed again from the filesystem — no Git process.`,
          caseFile('read-worktree-changes.ts'),
          93,
        ),
      ],
      runner: 'operations',
      gitCommands: CHANGES_GIT,
      tables: INVENTORY_READ,
      cost: `6 Git processes, measured the same for 2 changed files and for 10 (7 when a submodule pointer moved): the list carries no content, and working files are digested from the filesystem rather than hashed by Git, so cost does not grow with N and no filename can break it.`,
    },
    {
      id: 'changes.diffs',
      title: 'Read the hunks of the files being read',
      endpoint: {
        method: 'POST',
        path: '/api/worktrees/:worktreeId/changes/diffs',
        source: at(route('read-changes.ts'), 42),
      },
      webTriggers: [
        wt(
          'useChangeDiffs',
          web('query/review.ts'),
          275,
          `One request for the documents on screen, made by ReviewCodeDocument (views/review/review-code-document.tsx:47) when they mount. It carries the fingerprints its list was read at, because the observation token cannot see the bytes of an already-modified file; the server re-establishes them before answering. The document shows its own loading and error state, and neither this nor the list refetches on focus.`,
        ),
      ],
      steps: [
        s(
          'route',
          'changeRoutes POST changes/diffs',
          `A read with a body: it carries the observation it was made against and the exact changes asked for.`,
          route('read-changes.ts'),
          42,
        ),
        s(
          'application',
          'Application.changeDiffs',
          `Copies the selections and queues on the repository lane.`,
          APP,
          594,
        ),
        operationsStep(
          `Waits behind every earlier read or write of this repository.`,
        ),
        s(
          'use-case',
          'ReadChangeDiffs.execute',
          `Refuses more than 200 selections, requires the presented token, and resolves each selection to the exact comparison in that status.`,
          caseFile('read-change-diffs.ts'),
          57,
        ),
        s(
          'use-case',
          'ReadChangeDiffs.confirmFingerprints',
          `Re-establishes every presented fingerprint before the diff and again after it, against a fresh observation: checking only beforehand would answer a file edited mid-read with the newer patch under the older fingerprint.`,
          caseFile('read-change-diffs.ts'),
          144,
        ),
        s(
          'git',
          'readDiffs',
          `One git diff per scope, always: --raw -z names the files and their order, so sections are taken by position rather than by matching a header Git may have quoted. A scope larger than one response may carry answers with bounded omissions rather than a process per file.`,
          git('commands/read-diff.ts'),
          38,
        ),
        s(
          'use-case',
          'ResolveWorktree.reachable',
          `Confirms the checkout before the hunks leave the process.`,
          caseFile('read-change-diffs.ts'),
          87,
        ),
      ],
      runner: 'operations',
      gitCommands: DIFFS_GIT,
      tables: INVENTORY_READ,
      cost: `7 Git processes, measured the same for a 2-file layer and a 10-file one: one diff per scope, not one per file, and the status on each side of it.`,
    },
    {
      id: 'changes.lines',
      title: 'Read a range of lines for context',
      endpoint: {
        method: 'GET',
        path: '/api/worktrees/:worktreeId/changes/lines',
        source: at(route('read-changes.ts'), 61),
      },
      webTriggers: [],
      steps: [
        s(
          'route',
          'changeRoutes GET changes/lines',
          `Path, a one-based inclusive range, and where to read it from.`,
          route('read-changes.ts'),
          61,
        ),
        s(
          'application',
          'Application.changeLines',
          `Copies the range and queues on the repository lane.`,
          APP,
          614,
        ),
        operationsStep(
          `Waits behind every earlier read or write of this repository.`,
        ),
        s(
          'use-case',
          'ReadChangeLines.execute',
          `Validates the path and clamps the range to 2000 lines.`,
          caseFile('read-change-lines.ts'),
          34,
        ),
        s(
          'git',
          'readLines',
          `at=head runs git show HEAD:path. The file on disk is never a stand-in for the revision.`,
          git('commands/read-lines.ts'),
          18,
        ),
        s(
          'filesystem',
          'NodeFileReader.read',
          `at=worktree reads the working file through the no-follow boundary, under the same size bound as the Files surface, and costs no Git process. A lexically valid path is not a safe one: its last component or any ancestor can be a link out of the checkout.`,
          fsys('file-reader.ts'),
          63,
        ),
      ],
      runner: 'operations',
      gitCommands: [
        'rev-parse --absolute-git-dir; rev-parse --git-common-dir (verifyCheckout, once per request)',
        '[at=head] show HEAD:<path>',
      ],
      tables: INVENTORY_READ,
      cost: '3 Git processes at the last commit, 2 on disk.',
      notes: 'No caller yet: the context steps that use it are step 5c.',
    },
    {
      id: 'changes.reviewed-list',
      title: 'List reviewed marks',
      endpoint: {
        method: 'GET',
        path: '/api/worktrees/:worktreeId/reviewed',
        source: at(route('list-reviewed-files.ts'), 28),
      },
      webTriggers: [
        wt(
          'useReviewedOptions',
          web('query/review.ts'),
          157,
          `Fetched with evidence by usePrefetchReview and useReviewEvidence, so it follows the same mounts and the focus policy 'always'; optimistic updates come from the reviewed queue.`,
        ),
      ],
      steps: [
        s(
          'route',
          'listReviewedFiles GET reviewed',
          `Returns all marks of the worktree.`,
          route('list-reviewed-files.ts'),
          27,
        ),
        s(
          'application',
          'Application.listReviewedFiles',
          `Queues on operations although it is SQLite only.`,
          APP,
          371,
        ),
        operationsStep(`Waits behind any queued Git work.`),
        s(
          'use-case',
          'ListReviewedFiles.execute',
          `Requires a retained worktree ownership row.`,
          caseFile('list-reviewed-files.ts'),
          11,
        ),
        s(
          'repository',
          'ReviewedFileRepository.list',
          `Selects marks ordered by path.`,
          repo('reviewed-file-repository.ts'),
          27,
        ),
      ],
      runner: 'operations',
      gitCommands: [],
      tables: [
        { name: 'project_worktrees', access: 'read' },
        { name: 'reviewed_files', access: 'read' },
      ],
      cost: 'Two selects; latency is dominated by queue wait.',
    },
    {
      id: 'changes.reviewed-set',
      title: 'Mark a file reviewed',
      endpoint: {
        method: 'PUT',
        path: '/api/worktrees/:worktreeId/reviewed',
        source: at(route('set-reviewed-file.ts'), 17),
      },
      webTriggers: [
        wt(
          'useMarkReviewed',
          web('query/review.ts'),
          460,
          `Per checkbox click. enqueueReviewed (reviewed-queue.ts:16) serializes per worktree and applies the mark optimistically; the sidebar's dot is then worked out from the layers and marks already in cache, without asking for the worktree list again.`,
        ),
        wt(
          'useMarkAllReviewed',
          web('query/review.ts'),
          489,
          `Mark all: one PUT of the unreviewed fingerprintable files. A stale fingerprint is reported and left unmarked; the rest of the request still marks.`,
        ),
      ],
      steps: [
        s(
          'route',
          'setReviewedFile',
          `Body carries path and the fingerprint the reviewer saw.`,
          route('set-reviewed-file.ts'),
          16,
        ),
        s(
          'application',
          'Application.setReviewedFile',
          `Queues on operations.`,
          APP,
          635,
        ),
        operationsStep(`Serialized with all main-queue work.`),
        s(
          'use-case',
          'SetReviewedFile.execute',
          `Reads the change list again and refuses a fingerprint that no longer matches.`,
          caseFile('set-reviewed-file.ts'),
          36,
        ),
        s(
          'use-case',
          'ReadWorktreeChanges.execute',
          `The same read as changes.list, and the reason a mark is not free.`,
          caseFile('read-worktree-changes.ts'),
          50,
        ),
        s(
          'repository',
          'ReviewedFileRepository.set',
          `Immediate transaction; evicts the oldest marks beyond 2000.`,
          repo('reviewed-file-repository.ts'),
          46,
        ),
      ],
      runner: 'operations',
      gitCommands: CHANGES_GIT,
      tables: [
        { name: 'project_worktrees', access: 'read' },
        ...INVENTORY_READ,
        { name: 'reviewed_files', access: 'read' },
        { name: 'reviewed_files', access: 'write' },
      ],
      cost: `7 Git processes for one file, and the same order for mark all: one shared change read, not one read per file.`,
    },
    {
      id: 'changes.reviewed-remove',
      title: 'Unmark a file',
      endpoint: {
        method: 'DELETE',
        path: '/api/worktrees/:worktreeId/reviewed',
        source: at(route('remove-reviewed-file.ts'), 17),
      },
      webTriggers: [
        wt(
          'useUnmarkReviewed',
          web('query/review.ts'),
          315,
          `On unchecking a file; same per-worktree queue and summary invalidation as marking.`,
        ),
      ],
      steps: [
        s(
          'route',
          'removeReviewedFile',
          `Path in the query string.`,
          route('remove-reviewed-file.ts'),
          16,
        ),
        s(
          'application',
          'Application.removeReviewedFile',
          `Queues on operations although it is SQLite only.`,
          APP,
          384,
        ),
        operationsStep(`Waits behind any queued Git work.`),
        s(
          'use-case',
          'RemoveReviewedFile.execute',
          `Deletes the mark and returns the remaining marks.`,
          caseFile('remove-reviewed-file.ts'),
          14,
        ),
        s(
          'repository',
          'ReviewedFileRepository.remove',
          `One delete.`,
          repo('reviewed-file-repository.ts'),
          98,
        ),
      ],
      runner: 'operations',
      gitCommands: [],
      tables: [
        { name: 'project_worktrees', access: 'read' },
        { name: 'reviewed_files', access: 'write' },
        { name: 'reviewed_files', access: 'read' },
      ],
      cost: 'Three statements; latency is queue wait.',
    },
  ],
  decisions: [
    {
      title: 'Best-effort observations guarded before and after',
      summary: `The status token hashes the porcelain output; diff and evidence reject when status changes across the read, and checkout identity and conversion filters are checked around reads. The goal is never to show content from a replaced checkout or unconverted filtered files; the price is guard processes on every read and filter checks that scan every tracked path.`,
      doc: doc('git-working-tree-inspection.md'),
    },
    {
      title: 'Batch evidence diffs and cache the result',
      summary: `Spawning about ten processes per file made reviews take seconds, so evidence checks identity and filters once per batch and keeps the last result per worktree, keyed by status token plus inode, size and change times. A hit still pays a full status read, and files written in the last 2 s always recompute.`,
      doc: doc('git-working-tree-inspection.md'),
    },
    {
      title: 'Checkout-bound Git adapters in a private package',
      summary: `Adapters bind to a path and know nothing about HTTP, SQLite or Porcelain identity; the server owns coordination. Each adapter call therefore re-derives identity and filter state itself, because there is no per-request context to share. The same decision removed Turborepo caching as not worth its complexity yet.`,
      doc: doc('0006-git-package-and-task-cache.md'),
    },
    {
      title: 'Changes follows layer order through review queries',
      summary: `Review queries are keyed by environment, project and worktree, and Git actions invalidate whole projects because linked worktrees share a repository. That keeps linked worktrees correct but refetches all of them after one action.`,
      doc: doc('web-review-sidebar.md'),
    },
    {
      title: 'Identity verified around each Git read',
      summary: `Every InspectionGit call runs verifyCheckout before and after, so a checkout replaced mid-read is detected. It costs 4 rev-parse processes per status read.`,
      source: at(git('inspection-git.ts'), 23),
    },
    {
      title: 'GIT_OPTIONAL_LOCKS=0 and a scrubbed Git environment',
      summary: `Reads must never take index.lock or write the index, so they cannot collide with the agent's own Git; inherited GIT_DIR, config injection, external diff and lazy fetch are removed. Status therefore cannot refresh the stat cache, and fsmonitor and the untracked cache are disabled too, so Git re-stats files every time.`,
      source: at(git('run-git.ts'), 44),
    },
    {
      title: 'A reviewed mark is an evidence fingerprint',
      summary: `A mark is valid only while the file's evidence is unchanged, and the server re-reads evidence before accepting it. Marking is therefore a Git read, not a SQLite write.`,
      source: at(caseFile('set-reviewed-file.ts'), 33),
    },
  ],
  observations: [
    {
      kind: 'performance',
      title: 'Status cost grows with repository size',
      detail: `readStatus runs checkConversionFilters twice without a path list, which runs ls-files -z over the whole index and pipes every tracked path into check-attr. A 100k-file repository pays two full attribute scans per status, and status runs twice per evidence miss, twice per diff and once per summary.`,
      sources: [
        at(git('commands/read-status.ts'), 6),
        at(git('commands/read-status.ts'), 23),
        at(git('commands/check-conversion-filters.ts'), 26),
      ],
      confidence: 'verified',
    },
    {
      kind: 'performance',
      title: 'The filter check is now the floor',
      detail: `Of the 7 processes a change list costs, 3 are the conversion-filter check and 2 are the identity guard: only 2 are the reading itself. The check lists and attribute-checks every tracked path, so it grows with repository size while the rest does not. It is paid on every request rather than cached: a remembered "no filters" answer would be permission to run a filter configured afterwards, and the worktree watcher cannot see global or system Git config.`,
      sources: [
        at(git('commands/check-conversion-filters.ts'), 26),
        at(git('commands/read-status.ts'), 6),
      ],
      confidence: 'verified',
    },
    {
      kind: 'good',
      title: 'Reading what changed no longer grows with the change',
      detail: `The list carries paths, kinds and one fingerprint per path, and no content: measured at 7 Git processes for 2 changed files and for 10. The hunks are their own request for the documents on screen, and one git diff per scope covers a whole layer.`,
      sources: [
        at(caseFile('read-worktree-changes.ts'), 50),
        at(caseFile('read-change-diffs.ts'), 43),
        at('apps/server/src/http/routes/git-process-budgets.spec.ts', 152),
      ],
      confidence: 'verified',
    },
    {
      kind: 'performance',
      title: 'Marking is not free, and says so',
      detail: `A mark reads the change list again and refuses a fingerprint that no longer matches, so one file costs 7 processes rather than 0. The alternative was accepting a mark for content nobody saw. Mark all sends every file in one request and shares that read; a file whose fingerprint moved is left unmarked.`,
      sources: [
        at(caseFile('set-reviewed-file.ts'), 36),
        at(web('query/review.ts'), 489),
      ],
      confidence: 'verified',
    },
    {
      kind: 'risk',
      title: 'A lazy diff is only as fresh as the token it names',
      detail: `A diff request carries the observation its list was read at and the exact old and new path, and a mismatch is refused with 409. That keeps a current diff from being paired with an old fingerprint after a rename, but it also means an edit made while a reader is opening documents turns their next diff into an error they have to refresh past.`,
      sources: [
        at(caseFile('read-change-diffs.ts'), 66),
        at(web('query/review.ts'), 275),
      ],
      confidence: 'verified',
    },
    {
      kind: 'good',
      title: 'Batching removed the per-file guards',
      detail: `Identity and filters are checked once per batch and diffs run 8 at a time, so per-file cost dropped from about 10 processes to 1. The decision document records why.`,
      sources: [
        at(git('commands/read-diff.ts'), 18),
        at(doc('git-working-tree-inspection.md'), 56),
      ],
      confidence: 'verified',
    },
  ],
};

// ---------------------------------------------------------------------------
// review-layers
// ---------------------------------------------------------------------------

const reviewLayers: Area = {
  id: 'review-layers',
  title: 'Published reviews',
  webSurface:
    'Review summary, behavior layers, diagrams, step code and layer marks.',
  summary:
    'One optimistic atomic publication owns summary HTML and behavior layers. Pointers resolve against current code, committed steps fold, and uncovered changes remain visible. Layer marks track code fingerprints independently from file marks.',
  flows: [
    {
      id: 'review-layers.read',
      title: 'Read review',
      endpoint: {
        method: 'GET',
        path: '/api/worktrees/:worktreeId/review',
        source: {
          path: 'apps/server/src/http/routes/published-review.ts',
        },
      },
      webTriggers: [
        {
          hook: 'usePublishedReview',
          source: {
            path: 'apps/web/src/query/published-review.ts',
          },
          when: 'Open review and live notices; renew expiring summary capabilities.',
        },
      ],
      steps: [
        {
          layer: 'route',
          name: 'publishedReviewRoutes',
          source: {
            path: 'apps/server/src/http/routes/published-review.ts',
          },
          what: 'Validate the request and authenticated worktree scope.',
        },
        {
          layer: 'use-case',
          name: 'PublishedReview.read',
          source: {
            path: 'apps/server/src/use-cases/published-review.ts',
          },
          what: 'Capture or resolve exact code pointers and compute uncovered changes.',
        },
        {
          layer: 'repository',
          name: 'ReviewRepository',
          source: {
            path: 'apps/server/src/repositories/review-repository.ts',
          },
          what: 'Read or atomically replace the latest publication under its expected revision.',
        },
      ],
      runner: 'none',
      gitCommands: [],
      tables: [
        {
          name: 'reviews',
          access: 'read',
        },
      ],
      cost: 'Reads changed files and diffs for current diagnostics; unavailable Git leaves the saved publication readable.',
    },
    {
      id: 'review-layers.publish',
      title: 'Publish review',
      endpoint: {
        method: 'PUT',
        path: '/api/worktrees/:worktreeId/review',
        source: {
          path: 'apps/server/src/http/routes/published-review.ts',
        },
      },
      webTriggers: [],
      steps: [
        {
          layer: 'route',
          name: 'publishedReviewRoutes',
          source: {
            path: 'apps/server/src/http/routes/published-review.ts',
          },
          what: 'Validate the request and authenticated worktree scope.',
        },
        {
          layer: 'use-case',
          name: 'PublishedReview.publish',
          source: {
            path: 'apps/server/src/use-cases/published-review.ts',
          },
          what: 'Capture or resolve exact code pointers and compute uncovered changes.',
        },
        {
          layer: 'repository',
          name: 'ReviewRepository',
          source: {
            path: 'apps/server/src/repositories/review-repository.ts',
          },
          what: 'Read or atomically replace the latest publication under its expected revision.',
        },
      ],
      runner: 'none',
      gitCommands: [],
      tables: [
        {
          name: 'reviews',
          access: 'write',
        },
      ],
      cost: 'Reads changed files and diffs for current diagnostics; unavailable Git leaves the saved publication readable.',
    },
  ],
  decisions: [
    {
      title: 'Latest publication, no commit snapshots',
      summary:
        'Git stores commits; the latest review explains the work as a whole. Replacing it invalidates its previous summary capability.',
      doc: 'docs/decisions/artifact-storage.md',
    },
  ],
  observations: [],
};

const commentWriteWeb = (hook: string, line: number, when: string) =>
  wt(hook, web('query/comments.ts'), line, when);

const comments: Area = {
  id: 'comments',
  title: 'Comment threads',
  webSurface: `File discussion under the file header in Files and Changes, and the Comments view on the Review surface, which is where a discussion is acknowledged as read.`,
  summary: `Threads are JSON rows keyed by worktree ID, limited to 100 threads, 100 messages each and 1 MiB per worktree. Listing is a synchronous SQLite read outside the queue; writes go through the operations queue. HTTP writes are attributed to the reviewer and MCP writes to the agent. Every write takes the next revision, which is what the sidebar's dot and the owner's acknowledgement are both measured against; no Git runs for any of it.`,
  flows: [
    {
      id: 'comments.list',
      title: 'List threads',
      endpoint: {
        method: 'GET',
        path: '/api/worktrees/:worktreeId/comments',
        source: at(route('list-comment-threads.ts'), 16),
      },
      webTriggers: [
        wt(
          'useComments / usePrefetchComments',
          web('query/comments.ts'),
          113,
          `Prefetched by the review index (review-index.tsx:67) and read by code documents (code-document.tsx:109, review-code-document.tsx:257). ${FOCUS} Updated locally after each write.`,
        ),
      ],
      steps: [
        s(
          'route',
          'listCommentThreads',
          `Validates the scope.`,
          route('list-comment-threads.ts'),
          15,
        ),
        s(
          'application',
          'Application.comments (list)',
          `assertOpen, then executes synchronously outside the queue.`,
          APP,
          478,
        ),
        s(
          'use-case',
          'CommentThreads.execute',
          `Lists threads; checks inventory only when the list is empty.`,
          caseFile('comment-threads.ts'),
          48,
        ),
        s(
          'repository',
          'CommentRepository.list',
          `Selects rows by worktree ID in creation order and parses JSON.`,
          repo('comment-repository.ts'),
          11,
        ),
      ],
      runner: 'none',
      gitCommands: [],
      tables: [{ name: 'comment_threads', access: 'read' }, ...INVENTORY_READ],
      cost: 'One select over comment_threads, which has no worktree index; at most 100 threads per worktree.',
    },
    {
      id: 'comments.create',
      title: 'Create a thread',
      endpoint: {
        method: 'POST',
        path: '/api/worktrees/:worktreeId/comments',
        source: at(route('create-comment-thread.ts'), 17),
      },
      webTriggers: [
        commentWriteWeb(
          'useCreateComment',
          121,
          'On submit of the file discussion composer.',
        ),
      ],
      steps: [
        s(
          'route',
          'createCommentThread',
          `Adds author 'reviewer'.`,
          route('create-comment-thread.ts'),
          28,
        ),
        s(
          'application',
          'Application.comments (create)',
          `Copies the command and queues on operations.`,
          APP,
          478,
        ),
        operationsStep(`Waits behind queued Git work.`),
        s(
          'use-case',
          'CommentThreads.execute',
          `Validates body and anchor, requires the worktree in inventory, checks capacity.`,
          caseFile('comment-threads.ts'),
          57,
        ),
        s(
          'repository',
          'CommentRepository.usage',
          `One aggregate count and byte sum for the worktree.`,
          repo('comment-repository.ts'),
          32,
        ),
        s(
          'repository',
          'CommentRepository.save',
          `Inserts the thread JSON.`,
          repo('comment-repository.ts'),
          43,
        ),
      ],
      runner: 'operations',
      gitCommands: [],
      tables: [
        ...INVENTORY_READ,
        { name: 'comment_threads', access: 'read' },
        { name: 'comment_threads', access: 'write' },
      ],
      cost: 'Inventory read, one aggregate, one insert. The web then refetches the summary (13+ Git processes).',
    },
    {
      id: 'comments.reply',
      title: 'Reply to a thread',
      endpoint: {
        method: 'POST',
        path: '/api/worktrees/:worktreeId/comments/:threadId/replies',
        source: at(route('reply-to-comment.ts'), 17),
      },
      webTriggers: [
        commentWriteWeb('useReplyComment', 141, 'On reply submit.'),
      ],
      steps: [
        s(
          'route',
          'replyToComment',
          `Adds author 'reviewer'.`,
          route('reply-to-comment.ts'),
          16,
        ),
        s(
          'application',
          'Application.comments (reply)',
          `Queues on operations.`,
          APP,
          478,
        ),
        operationsStep(`Waits behind queued Git work.`),
        s(
          'use-case',
          'CommentThreads.execute',
          `Finds the thread in this worktree, appends a message and checks capacity.`,
          caseFile('comment-threads.ts'),
          77,
        ),
        s(
          'repository',
          'CommentRepository.save',
          `Upserts the whole thread JSON.`,
          repo('comment-repository.ts'),
          43,
        ),
      ],
      runner: 'operations',
      gitCommands: [],
      tables: [
        { name: 'comment_threads', access: 'read' },
        { name: 'comment_threads', access: 'write' },
      ],
      cost: 'Find, aggregate, upsert; rewrites the whole thread row.',
    },
    {
      id: 'comments.resolve',
      title: 'Resolve or reopen a thread',
      endpoint: {
        method: 'PUT',
        path: '/api/worktrees/:worktreeId/comments/:threadId/resolution',
        source: at(route('resolve-comment-thread.ts'), 17),
      },
      webTriggers: [
        commentWriteWeb('useResolveComment', 165, 'On resolve or reopen.'),
      ],
      steps: [
        s(
          'route',
          'resolveCommentThread',
          `Body is { resolved }.`,
          route('resolve-comment-thread.ts'),
          16,
        ),
        s(
          'application',
          'Application.comments (resolve)',
          `Queues on operations.`,
          APP,
          478,
        ),
        operationsStep(`Waits behind queued Git work.`),
        s(
          'use-case',
          'CommentThreads.execute',
          `Sets resolved idempotently; allowed at capacity.`,
          caseFile('comment-threads.ts'),
          77,
        ),
        s(
          'repository',
          'CommentRepository.save',
          `Upserts the thread JSON.`,
          repo('comment-repository.ts'),
          43,
        ),
      ],
      runner: 'operations',
      gitCommands: [],
      tables: [
        { name: 'comment_threads', access: 'read' },
        { name: 'comment_threads', access: 'write' },
      ],
      cost: 'Find and upsert.',
    },
  ],
  decisions: [
    {
      title: 'Flat threads with opaque anchors and no inventory foreign key',
      summary: `Anchors (path, optional lines, revision and fingerprint) are stored as submitted and never verified, and threads survive refresh and worktree disappearance. There is no anchor evolution, and creates are not idempotent, so a retry after an uncertain response can duplicate.`,
      doc: doc('worktree-comment-threads.md'),
    },
    {
      title: 'File discussion in the inspection header',
      summary: `Files and Changes share discussions by exact file path, drafts stay local and writes are never retried automatically. Renames do not migrate threads, and revision-bound threads are hidden from the current-file view.`,
      doc: doc('web-review-sidebar.md'),
    },
    {
      title: 'Agents share threads through MCP',
      summary: `MCP writes are attributed to the agent and HTTP writes to the reviewer; nothing is pushed to agents, so the reviewer asks the agent to read comments. Simple, but agents only learn about comments by polling.`,
      doc: 'docs/agent-review.md',
    },
    {
      title: 'List outside the queue, writes on it',
      summary: `Listing is frequent and pure SQLite, so it skips the queue; writes stay queued so messages append in operation order.`,
      source: at(APP, 478),
    },
  ],
  observations: [
    {
      kind: 'good',
      title: 'A comment write costs a comment write',
      detail: `Writing a comment no longer invalidates a summary that would re-run Git to recount threads. What a write moves is the thread's revision, which is what the dot and the owner's acknowledgement both measure from.`,
      sources: [
        at(repo('comment-repository.ts'), 47),
        at(repo('worktree-status-repository.ts'), 36),
      ],
      confidence: 'verified',
    },
    {
      kind: 'performance',
      title: 'comment_threads has no worktree index',
      detail: `The migration creates only the unique id index, so list and usage scan every thread of every worktree and parse JSON. Bounded per worktree, but it grows with the number of worktrees ever commented on.`,
      sources: [
        at('apps/server/drizzle/0000_current-schema.sql', 18),
        at(repo('comment-repository.ts'), 11),
      ],
      confidence: 'verified',
    },
    {
      kind: 'question',
      title: 'Decision document lags the code',
      detail: `worktree-comment-threads.md says messages make no authorship claims and MCP is outside the slice. Code records author reviewer or agent, exposes four MCP comment tools and ships a data backfill migration for authors.`,
      sources: [
        at(doc('worktree-comment-threads.md'), 8),
        at(route('create-comment-thread.ts'), 28),
        at('apps/server/src/http/mcp/review-server.ts', 99),
        at('apps/server/drizzle/0002_backfill_comment_authors.sql', 1),
      ],
      confidence: 'verified',
    },
    {
      kind: 'good',
      title: 'Capacity is one aggregate query',
      detail: `Thread count and byte usage come from one SQL aggregate instead of loading every thread; resolution stays possible at capacity.`,
      sources: [at(repo('comment-repository.ts'), 32)],
      confidence: 'verified',
    },
  ],
};

// ---------------------------------------------------------------------------
// artifacts
// ---------------------------------------------------------------------------

const artifacts: Area = {
  id: 'artifacts',
  title: 'Summary isolation',
  webSurface: 'The published review summary iframe.',
  summary:
    'Independent artifacts were retired. The review owns one summary served through an expiring capability and an opaque-origin sandbox. Migration 0008 removes obsolete artifact and per-commit layer tables; comments and file marks survive.',
  flows: [],
  decisions: [
    {
      title: 'HTML has no browser API authority',
      summary:
        'The response and iframe enforce sandbox isolation. The parent accepts layer navigation only from its own frame.',
      source: {
        path: 'apps/server/src/http/routes/review-summary.ts',
      },
    },
  ],
  observations: [],
};

const READABLE_GIT: string[] = [
  ...readableGit('before'),
  ...readableGit('after'),
];

const files: Area = {
  id: 'files',
  title: 'Files',
  webSurface: `Files tab: file tree, folder expansion, text viewer and editor with drafts, image and HTML previews, hide and unhide paths.`,
  summary: `File reads are filesystem reads bracketed by a Git identity check: before and after each directory, text, asset or tree read, the server runs git worktree list plus two rev-parse per worktree of the repository. The open text document polls every 3 s, and the Files view loads both a whole-tree listing (two ls-files plus an lstat walk of every path) and per-folder listings. Edits are guarded writes that invalidate every query of the worktree. Preferences are small SQLite rows per project.`,
  flows: [
    {
      id: 'files.paths',
      title: 'Read the names quick open searches',
      endpoint: {
        method: 'GET',
        path: '/api/worktrees/:worktreeId/paths',
        source: at(route('files.ts'), 26),
      },
      webTriggers: [
        wt(
          'useWorktreePaths',
          web('query/review.ts'),
          647,
          `When the Files navigation mounts (file-navigation.tsx:73). Read per opening rather than held: nothing can tell a cache it went stale until step 6's watcher, and a stale name list quietly stops finding files that are there.`,
        ),
      ],
      steps: [
        s(
          'route',
          'fileRoutes GET paths',
          `No query parameters.`,
          route('files.ts'),
          26,
        ),
        s(
          'application',
          'Application.worktreePaths',
          `Queues on the repository lane.`,
          APP,
          694,
        ),
        operationsStep(
          `Waits behind every earlier read or write of this repository.`,
        ),
        s(
          'use-case',
          'ListWorktreePaths.execute',
          `Identity by stat on both sides, and a refusal rather than a truncated list when the repository is larger than the bound.`,
          caseFile('list-worktree-paths.ts'),
          28,
        ),
        s(
          'git',
          'listTrackedPaths',
          `One ls-files, bounded twice: 4 MiB of output and 50,000 paths. One process is not a bounded answer — ls-files is O(repository) whatever it costs to start.`,
          git('commands/list-tracked-paths.ts'),
          18,
        ),
      ],
      runner: 'operations',
      gitCommands: ['ls-files -z --cached --others --exclude-standard'],
      tables: INVENTORY_READ,
      cost: `1 Git process. The whole-tree walk it replaced was 6 + 4W processes and O(paths x depth) filesystem calls for up to 50,000 paths.`,
    },
    {
      id: 'files.directory',
      title: 'List one folder',
      endpoint: {
        method: 'GET',
        path: '/api/worktrees/:worktreeId/directory',
        source: at(route('list-directory.ts'), 18),
      },
      webTriggers: [
        wt(
          'useDirectory / useDirectories',
          web('query/review.ts'),
          61,
          `The root on Files mount (file-navigation.tsx:70) plus one query per expanded or selected ancestor folder (file-navigation.tsx:91). Every mounted folder refetches on each focus and reconnect.`,
        ),
      ],
      steps: [
        s(
          'route',
          'listDirectory',
          `Relative path in the query; empty means root.`,
          route('list-directory.ts'),
          17,
        ),
        s(
          'application',
          'Application.listDirectory',
          `Queues on operations.`,
          APP,
          403,
        ),
        operationsStep(`Serialized with all main-queue work.`),
        readableStep('before', caseFile('list-directory.ts'), 18),
        s(
          'filesystem',
          'NodeFileReader.list',
          `Checks every path component, opendir (at most 2000 entries), verifies the path again.`,
          fsys('file-reader.ts'),
          25,
        ),
        readableStep('after', caseFile('list-directory.ts'), 28),
      ],
      runner: 'operations',
      gitCommands: READABLE_GIT,
      tables: INVENTORY_READ,
      cost: '4 + 4W Git processes per folder, plus one opendir.',
    },
    {
      id: 'files.text',
      title: 'Read a text file',
      endpoint: {
        method: 'GET',
        path: '/api/worktrees/:worktreeId/text',
        source: at(route('read-text-file.ts'), 35),
      },
      webTriggers: [
        wt(
          'useTextFile',
          web('query/review.ts'),
          206,
          `Each open text document (file-document.tsx:94). refetchInterval 3000 ms while the document is active and the page visible, plus the focus policy 'always'. MCP read_file uses the same path.`,
        ),
      ],
      steps: [
        s(
          'route',
          'readTextFile GET text',
          `Relative path in the query.`,
          route('read-text-file.ts'),
          34,
        ),
        s(
          'application',
          'Application.readTextFile',
          `Queues on operations.`,
          APP,
          413,
        ),
        operationsStep(`Serialized with all main-queue work.`),
        readableStep('before', caseFile('read-text-file.ts'), 19),
        s(
          'filesystem',
          'NodeFileReader.readBytes',
          `Component checks, O_NOFOLLOW open, fstat, bounded read (1 MiB), fstat again, path re-check.`,
          fsys('file-reader.ts'),
          75,
        ),
        readableStep('after', caseFile('read-text-file.ts'), 29),
        s(
          'use-case',
          'ReadTextFile.execute',
          `Adds a sha256 content fingerprint for drafts and anchors.`,
          caseFile('read-text-file.ts'),
          17,
        ),
      ],
      runner: 'operations',
      gitCommands: READABLE_GIT,
      tables: INVENTORY_READ,
      cost: '4 + 4W Git processes per read; the active document repeats it every 3 s.',
    },
    {
      id: 'files.asset',
      title: 'Read a binary asset from the worktree',
      endpoint: {
        method: 'GET',
        path: '/api/worktrees/:worktreeId/asset',
        source: at(route('read-text-file.ts'), 19),
      },
      webTriggers: [
        wt(
          'useAsset',
          web('query/preview-assets.ts'),
          7,
          `Image preview (image-preview.tsx:13), one query per image.`,
        ),
      ],
      steps: [
        s(
          'route',
          'readTextFile GET asset',
          `Returns { path, mediaType, base64 }.`,
          route('read-text-file.ts'),
          18,
        ),
        s(
          'application',
          'Application.readAsset',
          `Queues on operations.`,
          APP,
          408,
        ),
        operationsStep(`Serialized with all main-queue work.`),
        s(
          'use-case',
          'ReadAsset.execute',
          `Allows only image, CSS, JS and font extensions.`,
          caseFile('read-asset.ts'),
          33,
        ),
        readableStep('before', caseFile('read-asset.ts'), 37),
        s(
          'filesystem',
          'NodeFileReader.readBytes',
          `Guarded read up to 10 MiB.`,
          caseFile('read-asset.ts'),
          43,
        ),
        readableStep('after', caseFile('read-asset.ts'), 48),
      ],
      runner: 'operations',
      gitCommands: READABLE_GIT,
      tables: INVENTORY_READ,
      cost: '4 + 4W Git processes per asset. Image previews only since step 5d; an HTML preview reads its assets through files.preview-assets.',
    },
    {
      id: 'files.preview-assets',
      title: "Read a previewed document's assets",
      endpoint: {
        method: 'POST',
        path: '/api/worktrees/:worktreeId/preview-assets',
        source: at(route('read-preview-assets.ts'), 21),
      },
      webTriggers: [
        wt(
          'useHtmlPreview',
          web('query/preview-assets.ts'),
          19,
          `HTML preview (html-preview.tsx:15) asks once per round of discovery — the document's own references, then whatever its stylesheets named — instead of once per asset. The query key includes the whole HTML text.`,
        ),
      ],
      steps: [
        s(
          'route',
          'readPreviewAssets',
          `Carries the document the assets belong to, which is what bounds the request, and up to 64 paths.`,
          route('read-preview-assets.ts'),
          21,
        ),
        s(
          'application',
          'Application.previewAssets',
          `Queues on operations.`,
          APP,
          698,
        ),
        operationsStep(`Serialized with all main-queue work.`),
        s(
          'use-case',
          'ReadPreviewAssets.execute',
          `Refuses any path outside the document's folder, deduplicates, and reads sequentially against a shared 16 MiB budget so a request for sixty-four large files stops at the cap rather than allocating its way there.`,
          caseFile('read-preview-assets.ts'),
          42,
        ),
        s(
          'filesystem',
          'NodeFileReader.readBytes',
          `The same guarded read as a single asset: extension allow-list, 10 MiB, no final symlink, path rechecked after the bytes.`,
          caseFile('read-preview-assets.ts'),
          104,
        ),
      ],
      runner: 'operations',
      gitCommands: READABLE_GIT,
      tables: INVENTORY_READ,
      cost: 'One request per round of discovery rather than one per asset. Measured against the old path on 64 assets of 64 KiB: 64 requests and 171 ms became 1 request and 101 ms, for the same 5.3 MiB — it removes admissions and latency, not bytes.',
    },
    {
      id: 'files.edit',
      title: 'Write, create, move or trash a file',
      endpoint: {
        method: 'POST',
        path: '/api/worktrees/:worktreeId/files',
        source: at(route('edit-file.ts'), 16),
      },
      webTriggers: [
        wt(
          'useEditFile / useFileDraft',
          web('query/files.ts'),
          12,
          `On save, create, move or trash. Afterwards invalidates every query under the worktree scope (files.ts:46): status, evidence, reviewed marks, comments, tree, folders, text, summary, history and artifacts that are mounted all refetch.`,
        ),
      ],
      steps: [
        s('route', 'editFile', `8 MiB body limit.`, route('edit-file.ts'), 15),
        s(
          'application',
          'Application.editFile',
          `Queues with runOwned so a started write finishes its cleanup.`,
          APP,
          394,
        ),
        s(
          'runner',
          'Lanes.run (write, until settled) (operations)',
          `Same queue; settles only after the write unwinds.`,
          RUNNER,
          68,
        ),
        s(
          'use-case',
          'EditFile.execute',
          `Validates paths and write size, then one identity check.`,
          caseFile('edit-file.ts'),
          18,
        ),
        readableStep('before', caseFile('edit-file.ts'), 29),
        s(
          'filesystem',
          'NodeFileWriter.edit',
          `Write checks the expected fingerprint and replaces through a temporary file and rename; trash uses the OS trash.`,
          fsys('file-writer.ts'),
          29,
        ),
      ],
      runner: 'operations',
      gitCommands: readableGit('before'),
      tables: INVENTORY_READ,
      cost: 'Two Git processes, then the worktree-wide refetch fan-out on the client.',
    },
    {
      id: 'files.preferences-list',
      title: 'List file preferences',
      endpoint: {
        method: 'GET',
        path: '/api/projects/:projectId/file-preferences',
        source: at(route('list-file-preferences.ts'), 16),
      },
      webTriggers: [
        wt(
          'useHiddenPaths',
          web('query/file-preferences.ts'),
          44,
          `When Files mounts (file-navigation.tsx:81); Suspense; ${FOCUS}`,
        ),
      ],
      steps: [
        s(
          'route',
          'listFilePreferences',
          `Project-scoped.`,
          route('list-file-preferences.ts'),
          15,
        ),
        s(
          'application',
          'Application.listFilePreferences',
          `Queues on operations although it is SQLite only.`,
          APP,
          465,
        ),
        operationsStep(`Waits behind queued Git work.`),
        s(
          'use-case',
          'ListFilePreferences.execute',
          `Requires a registered project.`,
          caseFile('list-file-preferences.ts'),
          11,
        ),
        s(
          'repository',
          'FilePreferenceRepository.list',
          `Selects flags ordered by path.`,
          repo('file-preference-repository.ts'),
          13,
        ),
      ],
      runner: 'operations',
      gitCommands: [],
      tables: [
        ...INVENTORY_READ,
        { name: 'project_file_preferences', access: 'read' },
      ],
      cost: 'Inventory read plus one select; latency is queue wait.',
    },
    {
      id: 'files.preferences-set',
      title: 'Set a pin or hide flag',
      endpoint: {
        method: 'PUT',
        path: '/api/projects/:projectId/file-preferences',
        source: at(route('set-file-preference.ts'), 17),
      },
      webTriggers: [
        wt(
          'useSetHidden',
          web('query/file-preferences.ts'),
          74,
          `Hide or unhide from the Files menu; writes are serialized by a mutation scope and the returned list replaces the cache.`,
        ),
      ],
      steps: [
        s(
          'route',
          'setFilePreference',
          `Body { path, flag, value }.`,
          route('set-file-preference.ts'),
          16,
        ),
        s(
          'application',
          'Application.setFilePreference',
          `Copies intent and queues on operations.`,
          APP,
          467,
        ),
        operationsStep(`Waits behind queued Git work.`),
        s(
          'use-case',
          'SetFilePreference.execute',
          `Validates the canonical path and the project.`,
          caseFile('set-file-preference.ts'),
          14,
        ),
        s(
          'repository',
          'FilePreferenceRepository.set',
          `Immediate transaction with a 2000-path cap; deletes rows with no flags.`,
          repo('file-preference-repository.ts'),
          25,
        ),
      ],
      runner: 'operations',
      gitCommands: [],
      tables: [
        ...INVENTORY_READ,
        { name: 'project_file_preferences', access: 'read' },
        { name: 'project_file_preferences', access: 'write' },
      ],
      cost: 'A few statements in one transaction.',
    },
  ],
  decisions: [
    {
      title: 'A preview runs scripts and can still send itself away',
      summary: `An \`.html\` file previews from \`srcdoc\` in an opaque-origin sandbox with a prepended policy of \`default-src 'none'\`, so it makes no network request of its own: assets are carried inside it as \`data:\` URLs and references are bounded to the document's own folder, in the rewriter and again in the read. What the sandbox does not stop is the frame navigating itself, which no directive in this set governs, so a script can put what it can see into an address and go there. Scripts were kept because an agent's report is worth reading with its charts working; the leak is written down and the banner above the preview says it.`,
      doc: doc('html-preview-sandbox.md'),
    },
    {
      title: 'Guarded, bounded reads with identity checks before and after',
      summary: `The server assumes trusted local writers but still refuses symlink traversal, checks the checkout identity around reads and rejects observed changes with CONTENT_CHANGED. Results are observations, not snapshots, and every read pays a Git worktree listing twice.`,
      doc: doc('files-read-boundary.md'),
    },
    {
      title: 'Project-scoped pin and hide intent',
      summary: `Flags belong to the project, are shared by linked worktrees, and need not match existing paths; agents cannot change them. The client must submit canonical spellings because the server never resolves them.`,
      doc: doc('file-preferences.md'),
    },
    {
      title: 'Virtual lists and token highlighting for viewers',
      summary: `Large trees and files use TanStack Virtual, and highlighting renders tokens as text rather than HTML. That keeps rendering safe and bounded, but does nothing for the cost of fetching the tree.`,
      doc: doc('web-foundation.md'),
    },
    {
      title: 'Poll the active text document',
      summary: `Agents change files underneath the reviewer and there is no watch or push channel, so the active document refetches every 3 s. Simple and fresh, at a continuous Git cost.`,
      source: at(web('query/review.ts'), 230),
    },
    {
      title: 'Edits run as owned operations',
      summary: `A write that started must finish its cleanup even if the caller disconnects, so edits use runOwned, which settles only after the operation unwinds.`,
      source: at(APP, 396),
    },
  ],
  observations: [
    {
      kind: 'performance',
      title: 'File reads scale with the number of linked worktrees',
      detail: `resolveReadableWorktree runs Git.listWorktrees (rev-parse, worktree list, then two rev-parse per worktree) before and after every read. A repository with 6 worktrees costs 28 Git processes to read one text file, although InspectionGit answers the same identity question with 2.`,
      sources: [
        at(caseFile('resolve-readable-worktree.ts'), 23),
        at(git('commands/list-worktrees.ts'), 56),
        at(git('commands/verify-checkout.ts'), 5),
      ],
      confidence: 'verified',
    },
    {
      kind: 'performance',
      title: 'The open file polls through the main queue every 3 s',
      detail: `Each poll costs 4 + 4W Git processes and queues behind evidence and status, so it both adds load and arrives late while the queue is busy.`,
      sources: [at(web('query/review.ts'), 230), at(APP, 413)],
      confidence: 'verified',
    },
    {
      kind: 'performance',
      title: 'Opening Files no longer walks anything',
      detail: `The whole-tree read is gone. Opening Files is the root folder and the name list quick open searches; every other folder is read when somebody opens it. A folder holding a hundred thousand ignored files costs the same as any other, because listing its parent never descends into it — opening that folder itself still enumerates its own children and refuses past 2,000 entries or 1 MiB, which is the bound rather than a walk.`,
      sources: [
        at(fsys('file-reader.ts'), 34),
        at(caseFile('list-directory.ts'), 27),
      ],
      confidence: 'verified',
    },
    {
      kind: 'complexity',
      title: 'One listing per folder, and one for search',
      detail: `The Files navigation used to mount both a whole-tree query and per-folder queries for the same view. It now draws the tree from the folders that have been opened; the only whole-repository read left is the name list quick open searches, which is bounded and read per opening. Both still refetch on focus until step 6's watcher replaces that.`,
      sources: [
        at(web('views/review/file-navigation.tsx'), 70),
        at(web('views/review/file-navigation.tsx'), 71),
        at(web('views/review/file-navigation.tsx'), 91),
      ],
      confidence: 'verified',
    },
    {
      kind: 'performance',
      title: 'Saving a file refetches the whole worktree',
      detail: `After any edit the web invalidates every query of the worktree, including full evidence, the summary and loaded history pages, although one file changed.`,
      sources: [at(web('query/files.ts'), 46)],
      confidence: 'verified',
    },
    {
      kind: 'performance',
      title: 'HTML preview fans out to one request per asset',
      detail: `Up to 64 assets per preview, each a separate queued request with the double worktree listing.`,
      sources: [
        at(web('domain/html-assets.ts'), 45),
        at(caseFile('read-asset.ts'), 37),
      ],
      confidence: 'likely',
    },
    {
      kind: 'good',
      title: 'Careful path safety',
      detail: `Per-component lstat, realpath equality, O_NOFOLLOW opens and before/after metadata comparison reject symlink tricks and concurrent changes without claiming more than they prove.`,
      sources: [
        at(fsys('inspect-path.ts'), 23),
        at(fsys('file-reader.ts'), 75),
      ],
      confidence: 'verified',
    },
  ],
};

// ---------------------------------------------------------------------------
// history
// ---------------------------------------------------------------------------

const history: Area = {
  id: 'history',
  title: 'History',
  webSurface: `History tab: commit list with infinite scroll, and a commit document whose file list arrives first and whose patches follow as the reader moves down it.`,
  summary: `A page of history is one \`git log\` with a NUL-delimited format: the decorations come with the commits, so nothing asks for refs separately, and HEAD is read from the newest commit's own decoration. The page after this one is "the commits before X", anchored to the last commit shown rather than to an offset from the tip, so a page cannot shift when commits arrive and nothing has to be signed or kept. The guard costs no Git at all: it compares the two directories the registry already read, by stat.`,
  flows: [
    {
      id: 'history.list',
      title: 'List a page of commits',
      endpoint: {
        method: 'GET',
        path: '/api/worktrees/:worktreeId/commits',
        source: at(route('list-commits.ts'), 18),
      },
      webTriggers: [
        wt(
          'useHistory',
          web('query/history.ts'),
          18,
          `Suspense infinite query mounted by history navigation (history-navigation.tsx:46); the next page loads on scroll. Focus and reconnect refetching are off: reloading every loaded page cost a few hundred Git processes for history that had not changed. A page that restarted replaces the pages above it.`,
        ),
      ],
      steps: [
        s(
          'route',
          'listCommits',
          `Optional limit, and the commit to continue after.`,
          route('list-commits.ts'),
          17,
        ),
        s(
          'application',
          'Application.listCommits',
          `Queues on operations.`,
          APP,
          443,
        ),
        operationsStep(`Serialized with all main-queue work.`),
        s(
          'use-case',
          'resolveHistoryCheckout',
          `Requires an available worktree and carries both of its directories.`,
          caseFile('resolve-history-checkout.ts'),
          6,
        ),
        s(
          'git',
          'inspectHistoryCheckout',
          `Resolves the checkout's own .git from the path, stats it and the common directory, and reads the shallow file. No Git process, and run again before the answer leaves.`,
          git('commands/inspect-history-checkout.ts'),
          55,
        ),
        s(
          'git',
          '[continuation] merge-base --is-ancestor',
          `Whether the commit the list started at is still on the branch. Exit 1, or an unknown revision after a prune, restarts the list from the top instead of continuing a history this branch no longer has.`,
          git('commands/list-commits.ts'),
          96,
        ),
        s(
          'git',
          'git log -z --format',
          `One process: oid, parents, author, date, decoration, subject and body, seven NUL-terminated fields per commit, one more than the page asked for.`,
          git('commands/list-commits.ts'),
          137,
        ),
      ],
      runner: 'operations',
      gitCommands: [
        '[continuation] merge-base --is-ancestor <tip> HEAD',
        'log --topo-order -z --max-count=<limit + 1> --decorate-refs=refs/* --format=%H%x00%P%x00%an%x00%aI%x00%D%x00%s%x00%b [<frontier…> | HEAD]',
        '[unborn branch only] rev-parse --verify --quiet HEAD',
      ],
      tables: INVENTORY_READ,
      cost: `1 Git process for the newest commits, 2 for a continuation. Measured flat from 121 to 401 commits.`,
    },
    {
      id: 'history.files',
      title: 'Open a commit',
      endpoint: {
        method: 'GET',
        path: '/api/worktrees/:worktreeId/commits/:oid/files',
        source: at(route('read-commit-files.ts'), 34),
      },
      webTriggers: [
        wt(
          'useCommit',
          web('query/review.ts'),
          262,
          `When a commit document opens; first parent unless another is chosen. The commit's own details come with it, so a commit opened by link needs no history page.`,
        ),
      ],
      steps: [
        s(
          'git',
          'readCommitFiles',
          `One \`show --raw -z --format\`: the commit's fields and the names of the files it touched, and not one patch. \`--diff-merges=first-parent\` because a merge prints no file list at all without it.`,
          git('commands/read-commit-files.ts'),
          43,
        ),
      ],
      runner: 'operations',
      gitCommands: [
        'show --raw -z --format=<the page format> --diff-merges=first-parent <oid>',
        '[parent other than the first] diff-tree --no-commit-id -r --raw -z <parent> <oid>',
      ],
      tables: INVENTORY_READ,
      cost: `1 Git process, whatever the commit touched. 2 when a parent other than the first is asked for.`,
    },
    {
      id: 'history.diffs',
      title: "Read a commit's patches",
      endpoint: {
        method: 'POST',
        path: '/api/worktrees/:worktreeId/commits/:oid/diffs',
        source: at(route('read-commit-files.ts'), 47),
      },
      webTriggers: [
        wt(
          'useCommitDiffs',
          web('query/review.ts'),
          283,
          `The patches of the files reached so far, fifty at a time, in batches of at most two hundred. A commit cannot change, so the oid in the key is the whole of what makes the answer correct.`,
        ),
      ],
      steps: [
        s(
          'git',
          'readCommitDiffs',
          `The worktree's own diff reader over two objects instead of the index: same \`--raw -z --patch\`, same byte-level section splitting, same per-file decoding and per-patch cap.`,
          git('commands/read-diff.ts'),
          93,
        ),
      ],
      runner: 'operations',
      gitCommands: [
        'diff-tree --no-commit-id -r --root --diff-merges=first-parent … --raw -z --patch <oid> -- <pathspecs>',
      ],
      tables: INVENTORY_READ,
      cost: `1 Git process per batch, however many files are in it.`,
    },
  ],
  decisions: [
    {
      title: 'Pages are anchored to a commit, not to an offset',
      summary: `A page is continued from the frontier of the walk that produced it — the commits whose children have all been shown — which is exactly the queue the walk held, so a continuation reaches everything not yet shown and nothing already shown. One commit is not enough: in a history with merges the commit that ends a page is not an ancestor of the branches beside it, and walking from it alone drops them silently. The frontier is a handful of object ids, so a list survives a restart and a page already read cannot shift when commits arrive. Rewrite detection asks about the commit the list started at, not about the frontier, so what it walks is the commits added since; a tip that has been pruned answers the same question, and both cases restart from the top.`,
      source: at(git('commands/list-commits.ts'), 22),
    },
    {
      title: 'The guard spends no Git, and checks the path',
      summary: `The three \`rev-parse\` it used to run only resolved paths the registry already reads off the filesystem, and the shallow file answers \`--is-shallow-repository\` by existing. It resolves those paths from \`<checkout>/.git\` outwards rather than trusting the ones recorded at resolution: for a linked worktree both recorded directories live inside the main repository, so a checkout moved aside and replaced at the same path would otherwise pass. Because it costs nothing, it runs again before every page, file list and patch leaves.`,
      source: at(git('commands/inspect-history-checkout.ts'), 18),
    },
    {
      title: 'A commit opens like Changes',
      summary: `The file list carries no patches, so the size of a commit decides how long its list is rather than whether it can be opened at all. The patches come through the worktree's reader, generalised by which two sides it compares; a commit needs none of its guards, because the oid is the fingerprint.`,
      source: at(git('commands/read-commit-files.ts'), 33),
    },
  ],
  observations: [
    {
      kind: 'good',
      title: 'Stable paging with nothing kept',
      detail: `Pages neither shift, duplicate nor drop a branch, and a restart of the server does not invalidate a list somebody is scrolling: there is nothing to invalidate. The adapter spec concatenates every page and compares it with a full \`git log --topo-order\` on a history with merges.`,
      sources: [at(git('commands/list-commits.ts'), 49)],
      confidence: 'verified',
    },
    {
      kind: 'performance',
      title: 'Flat with depth',
      detail: `A page is one process and a continuation two, measured identical at 121 and 401 commits. Opening a commit is one; its patches one more per batch. The bench scenario — the list plus three commits, each with its patches read as the document reads them — fell from 89 processes to 7.`,
      sources: [at(route('git-process-budgets.spec.ts'), 425)],
      confidence: 'verified',
    },
    {
      kind: 'risk',
      title: 'A merge needs to be told which side it is read against',
      detail: `Plain \`--raw\` prints no file list for a merge commit, so a merge would open showing nothing changed. Both the list and the patches pass \`--diff-merges=first-parent\`; a parent other than the first costs one more process and is read on its own.`,
      sources: [at(git('commands/read-commit-files.ts'), 62)],
      confidence: 'verified',
    },
  ],
};

// ---------------------------------------------------------------------------
// git-actions
// ---------------------------------------------------------------------------

const gitActions: Area = {
  id: 'git-actions',
  title: 'Git actions',
  webSurface:
    'Commit, sync, stash, branches and recoverable discard from the review workspace.',
  summary:
    'One request admits a durable action. The repository lane checks the displayed branch and the files or refs the action depends on; receipts and progress arrive over the live connection.',
  flows: [
    {
      id: 'git-actions.run',
      title: 'Run a Git action',
      endpoint: {
        method: 'POST',
        path: '/api/projects/:projectId/worktrees/:worktreeId/git/actions',
        source: { path: route('run-git-action.ts') },
      },
      webTriggers: [],
      steps: [
        {
          layer: 'route',
          name: 'runGitAction',
          source: { path: route('run-git-action.ts') },
          what: 'Validate the action, displayed expectation and request ID.',
        },
        {
          layer: 'application',
          name: 'GitActionCoordinator',
          source: { path: COORDINATOR },
          what: 'Admit or recover the same durable request and schedule work on its repository lane.',
        },
        {
          layer: 'use-case',
          name: 'ExecuteGitAction',
          source: { path: caseFile('execute-git-action.ts') },
          what: 'Resolve checkout identity, check expectations and finalize the receipt.',
        },
        {
          layer: 'git',
          name: 'ActionGit',
          source: { path: git('action-git.ts') },
          what: 'Run the selected Git operation and report bounded progress.',
        },
      ],
      runner: 'operations',
      gitCommands: [],
      tables: [{ name: 'git_action_receipts', access: 'write' }],
      cost: 'Depends on the selected action; targeted checks replace whole-checkout preparation.',
    },
    {
      id: 'git-actions.receipt',
      title: 'Recover a receipt',
      endpoint: {
        method: 'GET',
        path: '/api/git-action-requests/:requestId',
        source: { path: route('get-git-action-receipt.ts') },
      },
      webTriggers: [],
      steps: [
        {
          layer: 'repository',
          name: 'GitActionRepository',
          source: { path: repo('git-action-repository.ts') },
          what: 'Read the scoped durable receipt without replaying Git.',
        },
      ],
      runner: 'none',
      gitCommands: [],
      tables: [{ name: 'git_action_receipts', access: 'read' }],
      cost: 'A scoped SQLite read.',
    },
    {
      id: 'git-actions.branches',
      title: 'List branches',
      endpoint: {
        method: 'GET',
        path: '/api/projects/:projectId/worktrees/:worktreeId/git/branches',
        source: { path: route('list-git-branches.ts') },
      },
      webTriggers: [],
      steps: [
        {
          layer: 'git',
          name: 'List branches',
          source: { path: git('commands/manage-branch.ts') },
          what: 'Report branch names, upstreams and worktree occupancy.',
        },
      ],
      runner: 'operations',
      gitCommands: [],
      tables: [],
      cost: 'Git ref and worktree metadata; no working-file content.',
    },
    {
      id: 'git-actions.draft',
      title: 'Draft a commit',
      endpoint: {
        method: 'POST',
        path: '/api/projects/:projectId/worktrees/:worktreeId/git/commit-draft',
        source: { path: route('commit-drafts.ts') },
      },
      webTriggers: [],
      steps: [
        {
          layer: 'use-case',
          name: 'CommitDrafts',
          source: { path: caseFile('commit-drafts.ts') },
          what: 'Read the chosen files and ask the selected agent for editable commit messages.',
        },
      ],
      runner: 'none',
      gitCommands: [],
      tables: [],
      cost: 'Selected-file diff and cancellable model generation.',
    },
  ],
  decisions: [],
  observations: [],
};

// ---------------------------------------------------------------------------
// mcp
// ---------------------------------------------------------------------------

const mcp: Area = {
  id: 'mcp',
  title: 'Agent MCP',
  webSurface: 'Agents publish reviews and share comment threads with the web.',
  summary:
    'The real CLI bridges stdio to the private owner socket without credentials. Six cwd-scoped tools and a review-guide resource form the agent interface. Agents use their own filesystem tools to inspect code.',
  flows: [
    {
      id: 'mcp.publish_review',
      title: 'publish review',
      mcpTool: {
        name: 'publish_review',
        source: {
          path: 'apps/server/src/http/mcp/review-server.ts',
        },
      },
      webTriggers: [],
      steps: [
        {
          layer: 'route',
          name: 'createReviewMcpServer',
          source: {
            path: 'apps/server/src/http/mcp/review-server.ts',
          },
          what: 'Resolve the registered worktree from the agent working directory, then call the owning operation.',
        },
      ],
      runner: 'none',
      gitCommands: [],
      tables: [],
      cost: 'Worktree resolution lists registered projects; the owning operation determines the remaining cost.',
    },
    {
      id: 'mcp.read_review',
      title: 'read review',
      mcpTool: {
        name: 'read_review',
        source: {
          path: 'apps/server/src/http/mcp/review-server.ts',
        },
      },
      webTriggers: [],
      steps: [
        {
          layer: 'route',
          name: 'createReviewMcpServer',
          source: {
            path: 'apps/server/src/http/mcp/review-server.ts',
          },
          what: 'Resolve the registered worktree from the agent working directory, then call the owning operation.',
        },
      ],
      runner: 'none',
      gitCommands: [],
      tables: [],
      cost: 'Worktree resolution lists registered projects; the owning operation determines the remaining cost.',
    },
    {
      id: 'mcp.list_comments',
      title: 'list comments',
      mcpTool: {
        name: 'list_comments',
        source: {
          path: 'apps/server/src/http/mcp/review-server.ts',
        },
      },
      webTriggers: [],
      steps: [
        {
          layer: 'route',
          name: 'createReviewMcpServer',
          source: {
            path: 'apps/server/src/http/mcp/review-server.ts',
          },
          what: 'Resolve the registered worktree from the agent working directory, then call the owning operation.',
        },
      ],
      runner: 'none',
      gitCommands: [],
      tables: [],
      cost: 'Worktree resolution lists registered projects; the owning operation determines the remaining cost.',
    },
    {
      id: 'mcp.create_comment',
      title: 'create comment',
      mcpTool: {
        name: 'create_comment',
        source: {
          path: 'apps/server/src/http/mcp/review-server.ts',
        },
      },
      webTriggers: [],
      steps: [
        {
          layer: 'route',
          name: 'createReviewMcpServer',
          source: {
            path: 'apps/server/src/http/mcp/review-server.ts',
          },
          what: 'Resolve the registered worktree from the agent working directory, then call the owning operation.',
        },
      ],
      runner: 'none',
      gitCommands: [],
      tables: [],
      cost: 'Worktree resolution lists registered projects; the owning operation determines the remaining cost.',
    },
    {
      id: 'mcp.reply_to_comment',
      title: 'reply to comment',
      mcpTool: {
        name: 'reply_to_comment',
        source: {
          path: 'apps/server/src/http/mcp/review-server.ts',
        },
      },
      webTriggers: [],
      steps: [
        {
          layer: 'route',
          name: 'createReviewMcpServer',
          source: {
            path: 'apps/server/src/http/mcp/review-server.ts',
          },
          what: 'Resolve the registered worktree from the agent working directory, then call the owning operation.',
        },
      ],
      runner: 'none',
      gitCommands: [],
      tables: [],
      cost: 'Worktree resolution lists registered projects; the owning operation determines the remaining cost.',
    },
    {
      id: 'mcp.resolve_comment',
      title: 'resolve comment',
      mcpTool: {
        name: 'resolve_comment',
        source: {
          path: 'apps/server/src/http/mcp/review-server.ts',
        },
      },
      webTriggers: [],
      steps: [
        {
          layer: 'route',
          name: 'createReviewMcpServer',
          source: {
            path: 'apps/server/src/http/mcp/review-server.ts',
          },
          what: 'Resolve the registered worktree from the agent working directory, then call the owning operation.',
        },
      ],
      runner: 'none',
      gitCommands: [],
      tables: [],
      cost: 'Worktree resolution lists registered projects; the owning operation determines the remaining cost.',
    },
  ],
  decisions: [],
  observations: [],
};

const lifecycle: Area = {
  id: 'lifecycle',
  title: 'Server lifecycle and queues',
  webSurface: `None directly. It sets startup time, request latency (queue wait) and shutdown behaviour for every surface.`,
  summary: `The CLI ensures a token file, then one composite runtime verifies the data directory is owner-only, takes a crash-released startup lock, claims the owner socket, opens SQLite (migration history check, WAL, migrate), recovers unfinished Git receipts and rescans every project before listening on both doors: HTTP under /api and a 0600 Unix socket for owner operations. Almost all work then flows through one serialized Lanes, 'operations', whose 30 s deadline starts at enqueue; discovery, browsing, summaries and drafting have their own single-lane runners. Shutdown drains both listeners for 5 s, waits for queued work, then closes the application exactly once. The working tree adds diagnostics channels for queue events and SQL, but not for Git processes.`,
  flows: [
    {
      id: 'lifecycle.startup',
      title: 'Start the server',
      webTriggers: [],
      steps: [
        s(
          'application',
          'runCli',
          `Parses serve options and installs SIGINT/SIGTERM handlers.`,
          'apps/server/src/cli/main.ts',
          29,
        ),
        s(
          'application',
          'runLocalServer',
          `Starts the server and waits for shutdown; there is no credential to prepare.`,
          'apps/server/src/cli/launcher.ts',
          23,
        ),
        s(
          'application',
          'startRuntime',
          `Claims the directory and socket under the startup lock, builds both listeners, and owns the application's lifetime.`,
          'apps/server/src/lifecycle/runtime.ts',
          75,
        ),
        s(
          'application',
          'createNetworkServer',
          `Registers every route once under /api, behind the Host and Origin checks.`,
          'apps/server/src/http/server.ts',
          85,
        ),
        s(
          'application',
          'createOwnerServer',
          `Serves status on the Unix socket only; reaching it is the credential.`,
          'apps/server/src/http/owner-server.ts',
          22,
        ),
        s(
          'application',
          'openApplication',
          `Builds repositories, use cases and the five runners.`,
          APP,
          79,
        ),
        s(
          'database',
          'openDatabase',
          `Checks migration history, sets busy_timeout, foreign keys and WAL, then migrates.`,
          'apps/server/src/db/connection.ts',
          12,
        ),
        s(
          'repository',
          'GitActionRepository.recover',
          `Turns running receipts into indeterminate ones.`,
          APP,
          126,
        ),
        s(
          'application',
          'listProjects',
          `Lists every project once on the inventory lane so the directory can resolve worktree IDs; failures are recorded, not raised, and callers wait for it through ready().`,
          APP,
          352,
        ),
      ],
      runner: 'operations',
      gitCommands: [
        'listWorktrees per project: rev-parse --git-common-dir; worktree list',
      ],
      tables: [
        { name: '__drizzle_migrations', access: 'read' },
        { name: '__drizzle_migrations', access: 'write' },
        { name: 'environment', access: 'write' },
        { name: 'git_action_receipts', access: 'read' },
        { name: 'git_action_receipts', access: 'write' },
        ...INVENTORY_WRITE,
      ],
      cost: 'Grows with P serial Git processes plus a stat per worktree, and with the size of git_action_receipts (recover reads all of it). The listing must finish within the 30 s operation deadline.',
    },
    {
      id: 'lifecycle.data-directory',
      title: 'Claim and release the data directory',
      webTriggers: [],
      steps: [
        s(
          'filesystem',
          'prepareDataDirectory',
          `mkdir 0700, realpath, then refuse any directory another user owns or can reach, because mkdir never tightens an existing one.`,
          'apps/server/src/lifecycle/data-directory.ts',
          12,
        ),
        s(
          'filesystem',
          'acquireStartupLock',
          `An exclusive SQLite transaction on startup.lock serializes claim-then-bind; fcntl means the kernel releases it if the holder dies.`,
          'apps/server/src/lifecycle/startup-lock.ts',
          22,
        ),
        s(
          'filesystem',
          'ownerSocketInUse',
          `Only a server that answers proves the directory is taken; a socket nothing listens on is what a crash leaves.`,
          'apps/server/src/lifecycle/owner-socket.ts',
          31,
        ),
        s(
          'filesystem',
          'restrictOwnerSocket',
          `chmod 0600 and confirm it before the owner door counts as ready.`,
          'apps/server/src/lifecycle/owner-socket.ts',
          52,
        ),
      ],
      runner: 'none',
      gitCommands: [],
      tables: [],
      cost: 'Constant.',
      notes:
        'Nothing is held for the process lifetime and a crash needs no cleanup: the startup lock dies with its holder, and the next start removes a socket that no longer answers.',
    },
    {
      id: 'lifecycle.migrations',
      title: 'Verify and apply migrations',
      webTriggers: [],
      steps: [
        s(
          'database',
          'assertMigrationHistory',
          `Rejects an untracked schema or any applied migration that differs from the shipped prefix.`,
          'apps/server/src/db/migrate.ts',
          14,
        ),
        s(
          'database',
          'PRAGMA busy_timeout, foreign_keys, journal_mode=WAL',
          `Connection settings for the single better-sqlite3 connection.`,
          'apps/server/src/db/connection.ts',
          24,
        ),
        s(
          'database',
          'migrateDatabase',
          `Drizzle applies newer checked-in SQL migrations.`,
          'apps/server/src/db/migrate.ts',
          49,
        ),
      ],
      runner: 'none',
      gitCommands: [],
      tables: [
        { name: 'sqlite_master', access: 'read' },
        { name: '__drizzle_migrations', access: 'read' },
        { name: '__drizzle_migrations', access: 'write' },
      ],
      cost: 'Constant at startup; data migrations (such as the comment author backfill) touch every affected row once.',
    },
    {
      id: 'lifecycle.operation-queue',
      title: 'Run an operation through a runner',
      webTriggers: [
        wt(
          'connection.request',
          web('query/workspace-provider.tsx'),
          40,
          `Every queued HTTP call; the browser gives up after 15 s but the server is not told.`,
        ),
      ],
      steps: [
        s(
          'runner',
          'Lanes.run',
          `Combines shutdown, a timeout created at enqueue and the caller signal, then chains after the previous operation.`,
          RUNNER,
          37,
        ),
        s(
          'runner',
          'publish queued/started/settled',
          `Publishes queue events on porcelain:operation when a subscriber exists.`,
          RUNNER,
          89,
        ),
        s(
          'runner',
          'Lanes.run (write, until settled)',
          `Same lane; the operation runs even if aborted while queued and the promise settles only after cleanup.`,
          RUNNER,
          68,
        ),
      ],
      runner: 'operations',
      gitCommands: [],
      tables: [],
      cost: 'Latency is the sum of all work queued ahead; the deadline counts queue wait.',
    },
    {
      id: 'lifecycle.git-action-recovery',
      title: 'Recover unfinished Git actions at startup',
      webTriggers: [],
      steps: [
        s(
          'repository',
          'GitActionRepository.recover',
          `Reads every receipt; running ones become indeterminate, and launched ones become PROCESS_GROUP_UNCONFIRMED, which blocks the project.`,
          repo('git-action-repository.ts'),
          106,
        ),
      ],
      runner: 'none',
      gitCommands: [],
      tables: [
        { name: 'git_action_receipts', access: 'read' },
        { name: 'git_action_receipts', access: 'write' },
      ],
      cost: 'One transaction over every stored receipt.',
    },
    {
      id: 'lifecycle.collect-absent',
      title: 'Forget worktrees that stayed gone',
      webTriggers: [],
      steps: [
        s(
          'application',
          'collection timer',
          `Runs hourly, unref'd, and swallows its own failures: housekeeping must not take the server with it.`,
          APP,
          237,
        ),
        s(
          'use-case',
          'CollectAbsentWorktrees.execute',
          `Deletes review data for IDs whose missing_since is older than 30 days, and the presence row last, so an interrupted pass repeats rather than orphans.`,
          caseFile('collect-absent-worktrees.ts'),
          20,
        ),
      ],
      runner: 'none',
      gitCommands: [],
      tables: [
        { name: 'worktree_presence', access: 'read' },
        { name: 'worktree_presence', access: 'write' },
        { name: 'reviewed_files', access: 'write' },
        { name: 'comment_threads', access: 'write' },
        { name: 'artifacts', access: 'write' },
        { name: 'review_layer_sets', access: 'write' },
      ],
      cost: 'One transaction per expired worktree; nothing runs while every worktree is present.',
    },
    {
      id: 'lifecycle.shutdown',
      title: 'Shut down',
      webTriggers: [],
      steps: [
        s(
          'application',
          'installShutdownSignals',
          `SIGINT and SIGTERM abort the launcher.`,
          'apps/server/src/cli/signals.ts',
          2,
        ),
        s(
          'application',
          'closeListener',
          `Closes a listener and force-closes its connections after 5 s.`,
          'apps/server/src/lifecycle/runtime.ts',
          40,
        ),
        s(
          'application',
          'shutDown',
          `Network door first, then the application drains, then the owner socket last: its absence is what frees the directory, so it cannot go before the database has closed.`,
          'apps/server/src/lifecycle/runtime.ts',
          56,
        ),
        s(
          'runner',
          'Application.close',
          `Closes side runners, then waits for the operations queue and closes SQLite.`,
          APP,
          553,
        ),
        s(
          'filesystem',
          'owner listener close',
          `Node unlinks the socket it bound; a refused start never removes a live one.`,
          'apps/server/src/lifecycle/runtime.ts',
          64,
        ),
      ],
      runner: 'operations',
      gitCommands: [],
      tables: [],
      cost: 'Bounded by in-flight work: up to 120 s for an owned Git action or draft.',
    },
  ],
  decisions: [
    {
      title: 'Explicit configuration, a crash-released lock, no stale takeover',
      summary: `Startup validates host, port, token and an absolute data directory. One server owns a data directory, proved by the owner socket answering rather than by a PID. The claim-then-bind window is serialized by an OS-released advisory lock, so two starters cannot both decide a socket is stale and the second delete the first's live one — and a crash leaves nothing to remove by hand.`,
      doc: doc('0005-local-server-startup.md'),
    },
    {
      title: 'Migration history is the schema contract',
      summary: `Startup verifies the whole applied prefix before migrating and never uses schema push. Unreleased baselines may be regenerated, which means disposable development databases.`,
      doc: doc('0003-drizzle-and-fastify.md'),
    },
    {
      title: 'Plain TypeScript with explicit dependencies',
      summary: `No framework or container: app.ts wires every dependency by hand. The composition is easy to read, and it is also the only place where the choice of queue per operation is visible.`,
      doc: doc('0001-foundation.md'),
    },
    {
      title: 'Mappers and scoped helpers, not service layers',
      summary: `Parsing and validation live in mappers and helpers next to their owner, and each route is its own small file. Tracing one request crosses route, group, application, use case, adapter and command files.`,
      doc: doc('server-internal-modularity.md'),
    },
    {
      title: 'Real environments for tests, no simulated DOM',
      summary: `Unit specs in Node, view specs in real Chromium, end-to-end on the built app with a disposable server. None of these layers counts Git processes or queue wait, which is why fan-out went unnoticed.`,
      doc: doc('test-environments.md'),
    },
    {
      title: 'One serialized operations queue',
      summary: `A single lane gives one SQLite writer, a deterministic order between Git reads and writes on repositories shared by linked worktrees, and simple cancellation and shutdown. The cost is head-of-line blocking: a slow evidence read delays a 5 ms SQLite read.`,
      source: at(APP, 97),
    },
    {
      title: 'Separate single-lane runners for long or background work',
      summary: `Discovery, folder browsing, sidebar summaries and LLM drafting each get their own runner so they cannot block the main lane. Each of those is still serial within itself.`,
      source: at(APP, 102),
    },
    {
      title: 'Every Git process is bounded',
      summary: `10 s timeout with SIGKILL, capped output and a scrubbed environment for every read; Git actions run in their own process group with a cleanup budget. Hung processes cannot hold the queue forever, but a timeout is not treated as repository unavailability.`,
      source: at(git('run-git.ts'), 40),
    },
    {
      title: 'Diagnostics channels for tooling',
      summary: `Queue events (porcelain:operation) publish only when something subscribes. The SQL trace hook (porcelain:sql) is installed only when a subscriber exists as the database opens, because better-sqlite3 converts every statement to a string once it is set. Production has no subscribers and pays nothing; tooling must subscribe before the server starts.`,
      source: at(RUNNER, 8),
    },
  ],
  observations: [
    {
      kind: 'performance',
      title: 'Head-of-line blocking on one queue',
      detail: `Status, diff, evidence, reviewed marks, file tree, folders, text, assets, edits, register, refresh, remove, history, commit changes, file preferences, comment writes, commit layers, layer replace, artifacts and every Git action share operations. Only inventory reads, layer reads, comment lists and receipt reads bypass it. One evidence miss of a few seconds delays everything behind it.`,
      sources: [
        at(APP, 344),
        at(APP, 366),
        at(APP, 413),
        at(APP, 441),
        at(APP, 541),
        at(RUNNER, 37),
      ],
      confidence: 'verified',
    },
    {
      kind: 'performance',
      title: 'SQLite-only operations still queue',
      detail: `Reviewed list and unmark, file preferences, artifacts, commit-layer reads and layer replace touch only SQLite yet go through operations.run. better-sqlite3 is synchronous, so they could run immediately like comment lists.`,
      sources: [
        at(APP, 371),
        at(APP, 384),
        at(APP, 465),
        at(APP, 487),
        at(APP, 541),
      ],
      confidence: 'verified',
    },
    {
      kind: 'risk',
      title: 'The deadline counts queue wait',
      detail: `AbortSignal.timeout is created when the operation is enqueued, so under a focus burst later requests fail with 503 before they start, even though their own work is cheap.`,
      sources: [
        at(RUNNER, 43),
        at('apps/server/src/config/application-settings.ts', 12),
      ],
      confidence: 'verified',
    },
    {
      kind: 'risk',
      title: 'Abandoned requests keep running',
      detail: `Most routes call the application without a request signal, so the server never learns that the browser gave up after 15 s. The next focus enqueues fresh copies while the old ones still run, and the queue can pile up.`,
      sources: [
        at(route('read-text-file.ts'), 45),
        at(web('query/workspace-provider.tsx'), 40),
        at(route('project-locations.ts'), 46),
      ],
      confidence: 'verified',
    },
    {
      kind: 'risk',
      title: 'One slow repository can still stop the server from starting',
      detail: `Startup awaits one listing of every project under the 30 s deadline. An unreadable repository is now data — it is recorded unavailable and the listing succeeds — but a Git process killed by the timeout is still a fault, so a hung network mount fails ready() and openApplication closes everything. Per-project timeouts are step 4b.`,
      sources: [
        at(APP, 352),
        at('apps/server/src/lifecycle/worktree-directory.ts', 118),
        at(git('errors/is-repository-unavailable.ts'), 13),
        at(git('run-git.ts'), 20),
      ],
      confidence: 'verified',
    },
    {
      kind: 'complexity',
      title: 'One Git runner, guards once per request',
      detail: `executeCommand, executeInspection, executeHistoryCommand and GitActionProcess each scrub the environment and map errors differently. Checkout identity is checked by verifyCheckout (2 processes), by listWorktrees (2) and by inspectHistoryCheckout (4, including git --version): the same question at three prices.`,
      sources: [
        at(git('run-git.ts'), 8),
        at(git('run-git.ts'), 9),
        at(git('read-history.ts'), 7),
        at(git('run-git.ts'), 36),
        at(git('commands/verify-checkout.ts'), 5),
        at(caseFile('resolve-readable-worktree.ts'), 23),
        at(git('commands/inspect-history-checkout.ts'), 13),
      ],
      confidence: 'verified',
    },
    {
      kind: 'question',
      title: 'No spec asserts a process budget yet',
      detail: `Queues (porcelain:operation), SQL (porcelain:sql) and Git spawns (Node's built-in child_process channel) are all observable; the lab attributes them per request. Specs could subscribe to the same channels to assert a process budget per request, which is the regression the owner could not see.`,
      sources: [at(RUNNER, 8), at('apps/server/src/db/connection.ts', 10)],
      confidence: 'verified',
    },
    {
      kind: 'good',
      title: 'Recovery never replays',
      detail: `Unfinished receipts become indeterminate instead of being re-run, and shutdown waits for owned work before closing SQLite.`,
      sources: [at(repo('git-action-repository.ts'), 106), at(RUNNER, 114)],
      confidence: 'verified',
    },
  ],
};

export const areas: Area[] = [
  connection,
  inventory,
  changes,
  reviewLayers,
  comments,
  artifacts,
  files,
  history,
  gitActions,
  mcp,
  lifecycle,
];
