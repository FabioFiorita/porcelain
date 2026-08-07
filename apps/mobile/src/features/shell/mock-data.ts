/**
 * Screenshot-ready mock content for the tablet shell outer layer.
 * Real daemon wiring lands later; agents fill these slots with live lists.
 */

export type SurfaceId = 'files' | 'changes' | 'review' | 'history' | 'search' | 'board' | 'terminal'

export type SurfacePath =
  | '/'
  | '/changes'
  | '/review'
  | '/history'
  | '/search'
  | '/board'
  | '/terminal'

export type Surface = {
  readonly id: SurfaceId
  readonly label: string
  readonly path: SurfacePath
  readonly listTitle: string
  readonly listHint: string
  readonly viewerKind: 'file' | 'diff' | 'review' | 'history' | 'search' | 'board' | 'terminal'
}

export type ListItem = {
  readonly id: string
  readonly label: string
  readonly detail: string
  readonly badge?: string
  readonly state?: 'active' | 'ready' | 'attention'
}

export type CompanionRow = {
  readonly id: string
  readonly label: string
  readonly detail?: string
}

export type CompanionSection = {
  readonly id: string
  readonly title: string
  readonly rows: readonly CompanionRow[]
}

export type MockProject = {
  readonly id: string
  readonly name: string
  readonly path: string
  readonly group: 'open' | 'recent'
}

export type MockBranch = {
  readonly id: string
  readonly name: string
  readonly current?: boolean
}

export type MockWorktree = {
  readonly id: string
  readonly name: string
  readonly path: string
  readonly current?: boolean
}

export type MockEnvironment = {
  readonly id: string
  readonly name: string
  readonly host: string
  readonly active?: boolean
}

/** Rail order matches web: navigate → diffs → Review → history → find → plan → shell. */
export const SURFACES: readonly Surface[] = [
  {
    id: 'files',
    label: 'Files',
    path: '/',
    listTitle: 'Files',
    listHint: 'Workspace tree for the current project.',
    viewerKind: 'file',
  },
  {
    id: 'changes',
    label: 'Changes',
    path: '/changes',
    listTitle: 'Changes',
    listHint: 'Working tree and staged files.',
    viewerKind: 'diff',
  },
  {
    id: 'review',
    label: 'Review',
    path: '/review',
    listTitle: 'Review',
    listHint: 'Units of work waiting for sign-off.',
    viewerKind: 'review',
  },
  {
    id: 'history',
    label: 'History',
    path: '/history',
    listTitle: 'History',
    listHint: 'Recent commits on this branch.',
    viewerKind: 'history',
  },
  {
    id: 'search',
    label: 'Search',
    path: '/search',
    listTitle: 'Search',
    listHint: 'Query and results across the tree.',
    viewerKind: 'search',
  },
  {
    id: 'board',
    label: 'Board',
    path: '/board',
    listTitle: 'Board',
    listHint: 'Cards in the agent workflow.',
    viewerKind: 'board',
  },
  {
    id: 'terminal',
    label: 'Terminal',
    path: '/terminal',
    listTitle: 'Terminal',
    listHint: 'Sessions and saved actions.',
    viewerKind: 'terminal',
  },
]

export const LIST_ITEMS: Record<SurfaceId, readonly ListItem[]> = {
  files: [
    { id: 'root', label: 'porcelain', detail: 'Workspace root', state: 'active' },
    { id: 'apps-mobile', label: 'apps/mobile', detail: 'Native client', state: 'ready' },
    { id: 'apps-web', label: 'apps/web', detail: 'Browser client', state: 'ready' },
    { id: 'packages', label: 'packages/contracts', detail: 'Shared types', state: 'ready' },
    { id: 'agents', label: '.agents/skills', detail: 'Agent guidance', badge: '3' },
  ],
  changes: [
    {
      id: 'shell-tsx',
      label: 'tablet-shell.tsx',
      detail: 'apps/mobile · modified',
      state: 'attention',
      badge: 'M',
    },
    {
      id: 'mock-data',
      label: 'mock-data.ts',
      detail: 'apps/mobile · added',
      state: 'attention',
      badge: 'A',
    },
    { id: 'layout', label: '_layout.tsx', detail: 'apps/mobile · modified', badge: 'M' },
    { id: 'staged', label: 'client.md', detail: 'Staged', state: 'ready', badge: 'S' },
  ],
  review: [
    {
      id: 'tablet-shell',
      label: 'Tablet shell outer layer',
      detail: 'In progress · Intent set',
      state: 'active',
    },
    {
      id: 'nav-poc',
      label: 'Navigation POC',
      detail: 'Superseded by shell',
      state: 'ready',
    },
    {
      id: 'daemon-pair',
      label: 'Daemon pairing polish',
      detail: '2 comments',
      state: 'attention',
      badge: '2',
    },
  ],
  history: [
    {
      id: 'c1',
      label: 'a3f2c01',
      detail: 'Shell: tablet SplitView POC',
      state: 'active',
    },
    { id: 'c2', label: '91be440', detail: 'Mobile: NativeWind reusables pass' },
    { id: 'c3', label: '0e12ab9', detail: 'Daemon: environments store' },
    { id: 'c4', label: '77c0d1e', detail: 'Web: companion retitle' },
  ],
  search: [
    {
      id: 'q1',
      label: 'SplitView inspector',
      detail: '12 results · apps/mobile',
      state: 'active',
    },
    { id: 'q2', label: 'useActiveEnvironment', detail: '4 results · lib/daemon' },
    { id: 'q3', label: 'SidebarTab', detail: '8 results · apps/web' },
  ],
  board: [
    { id: 'doing', label: 'Tablet chrome', detail: 'Doing', state: 'active', badge: '1' },
    { id: 'todo-viewer', label: 'Viewer file tree', detail: 'Todo', state: 'ready' },
    { id: 'todo-diff', label: 'Diff canvas', detail: 'Todo', state: 'ready' },
    { id: 'done', label: 'NativeWind shell', detail: 'Done', state: 'ready' },
  ],
  terminal: [
    { id: 'verify', label: 'pnpm verify', detail: 'Saved action', state: 'ready' },
    { id: 'typecheck', label: 'pnpm --dir apps/mobile typecheck', detail: 'Saved action' },
    {
      id: 'session',
      label: 'zsh · porcelain',
      detail: 'Last run 2m ago',
      state: 'attention',
    },
  ],
}

export const COMPANION: Record<SurfaceId, readonly CompanionSection[]> = {
  files: [
    {
      id: 'pins',
      title: 'Pinned',
      rows: [
        { id: 'p1', label: 'apps/mobile/src/app/_layout.tsx', detail: 'Root layout' },
        { id: 'p2', label: '.agents/skills/mobile/SKILL.md', detail: 'Runbook' },
      ],
    },
    {
      id: 'notes',
      title: 'Notes',
      rows: [{ id: 'n1', label: 'Outer shell first — fill lists later', detail: 'Local note' }],
    },
  ],
  changes: [
    {
      id: 'suggest',
      title: 'Suggested commit',
      rows: [
        {
          id: 's1',
          label: 'feat(mobile): tablet shell outer layer',
          detail: 'Draft · mock only',
        },
      ],
    },
    {
      id: 'commands',
      title: 'Quick commands',
      rows: [
        { id: 'c1', label: 'Stage all' },
        { id: 'c2', label: 'Discard file' },
        { id: 'c3', label: 'Commit' },
      ],
    },
    {
      id: 'comments',
      title: 'Comments',
      rows: [{ id: 'cm1', label: 'Check SplitView column metrics on landscape', detail: 'You' }],
    },
  ],
  review: [
    {
      id: 'reading',
      title: 'Now reading',
      rows: [
        { id: 'r1', label: 'Intent', detail: 'Outer tablet chrome' },
        { id: 'r2', label: 'Execution', detail: 'Shell + mock slots' },
        { id: 'r3', label: 'Evidence', detail: 'Simulator screenshots' },
      ],
    },
    {
      id: 'comments',
      title: 'Comments',
      rows: [{ id: 'cm1', label: 'Settings stays a sheet, not the rail', detail: 'Product' }],
    },
  ],
  history: [
    {
      id: 'git',
      title: 'Git commands',
      rows: [
        { id: 'g1', label: 'Checkout commit' },
        { id: 'g2', label: 'Cherry-pick' },
        { id: 'g3', label: 'Copy SHA' },
      ],
    },
    {
      id: 'timeline',
      title: 'File timeline',
      rows: [
        { id: 't1', label: 'tablet-shell.tsx', detail: 'touched in a3f2c01' },
        { id: 't2', label: 'mock-data.ts', detail: 'added' },
      ],
    },
  ],
  search: [
    {
      id: 'recent',
      title: 'Recent',
      rows: [
        { id: 'rs1', label: 'SplitView' },
        { id: 'rs2', label: 'companion' },
        { id: 'rs3', label: 'environments' },
      ],
    },
  ],
  board: [
    {
      id: 'focus',
      title: 'Focus card',
      rows: [
        { id: 'f1', label: 'Tablet chrome', detail: 'Doing · this session' },
        { id: 'f2', label: 'Move to Done when shell screenshots land' },
      ],
    },
  ],
  terminal: [
    {
      id: 'actions',
      title: 'Saved actions',
      rows: [
        { id: 'a1', label: 'pnpm verify', detail: 'Root' },
        { id: 'a2', label: 'pnpm --dir apps/mobile typecheck' },
        { id: 'a3', label: 'eas fingerprint:compare' },
      ],
    },
  ],
}

export const MOCK_WORKSPACE = {
  projectName: 'porcelain',
  projectPath: '~/code/porcelain',
  branch: 'main',
  worktree: 'current',
  /** Short env label for the header chip (host stays in settings). */
  environmentName: 'Linux',
  environmentHost: 'beelink.local:43118',
} as const

export const MOCK_PROJECTS: readonly MockProject[] = [
  {
    id: 'open-porcelain',
    name: 'porcelain',
    path: '~/code/porcelain',
    group: 'open',
  },
  {
    id: 'recent-playground',
    name: 'playground',
    path: '~/code/playground',
    group: 'recent',
  },
  {
    id: 'recent-notes',
    name: 'notes',
    path: '~/Documents/notes',
    group: 'recent',
  },
]

export const MOCK_BRANCHES: readonly MockBranch[] = [
  { id: 'main', name: 'main', current: true },
  { id: 'work-tablet-shell', name: 'work/tablet-shell' },
  { id: 'work-mobile-poc', name: 'work/mobile-poc' },
]

export const MOCK_WORKTREES: readonly MockWorktree[] = [
  {
    id: 'current',
    name: 'current',
    path: '~/code/porcelain',
    current: true,
  },
  {
    id: 'tablet',
    name: 'tablet-shell',
    path: '~/.porcelain-worktrees/tablet-shell',
  },
]

export const MOCK_ENVIRONMENTS: readonly MockEnvironment[] = [
  {
    id: 'linux-dev',
    name: 'Linux · dev',
    host: 'beelink.local:43118',
    active: true,
  },
  {
    id: 'mac-dev',
    name: 'Mac · dev',
    host: 'macbook.local:43118',
  },
]

export const VIEWER_PLACEHOLDERS: Record<Surface['viewerKind'], { title: string; body: string }> = {
  file: {
    title: 'File viewer',
    body: 'One file at a time. Source, markdown reader, or HTML preview lands here.',
  },
  diff: {
    title: 'Diff viewer',
    body: 'Unified or split diff for the selected change. Hunks and stage actions come later.',
  },
  review: {
    title: 'Review canvas',
    body: 'Intent · Execution · Evidence for the selected unit of work.',
  },
  history: {
    title: 'Commit view',
    body: 'Commit message, metadata, and the file list for this revision.',
  },
  search: {
    title: 'Search results',
    body: 'Matches for the active query, grouped by path.',
  },
  board: {
    title: 'Board',
    body: 'Larger board canvas. Columns and card detail fill this slot.',
  },
  terminal: {
    title: 'Terminal',
    body: 'Session output and the key bar for the selected terminal or action.',
  },
}

export function surfaceForPath(path: string): Surface {
  const normalized = path === '' ? '/' : path
  return SURFACES.find((surface) => surface.path === normalized) ?? SURFACES[0]
}

export function surfaceById(id: SurfaceId): Surface {
  return SURFACES.find((surface) => surface.id === id) ?? SURFACES[0]
}

export function defaultSelectedIds(): Record<SurfaceId, string> {
  return {
    files: LIST_ITEMS.files[0]?.id ?? '',
    changes: LIST_ITEMS.changes[0]?.id ?? '',
    review: LIST_ITEMS.review[0]?.id ?? '',
    history: LIST_ITEMS.history[0]?.id ?? '',
    search: LIST_ITEMS.search[0]?.id ?? '',
    board: LIST_ITEMS.board[0]?.id ?? '',
    terminal: LIST_ITEMS.terminal[0]?.id ?? '',
  }
}
