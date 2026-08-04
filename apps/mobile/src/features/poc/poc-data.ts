export type PocSurfaceId = 'files' | 'changes' | 'review' | 'terminal'

export type PocSurface = {
  readonly id: PocSurfaceId
  readonly label: string
  readonly eyebrow: string
  readonly description: string
  readonly path: '/' | '/changes' | '/review' | '/terminal'
}

export type PocItem = {
  readonly id: string
  readonly label: string
  readonly detail: string
  readonly state?: 'active' | 'ready' | 'attention'
}

export const POC_SURFACES: readonly PocSurface[] = [
  {
    id: 'files',
    label: 'Files',
    eyebrow: 'Workspace',
    description: 'A tree-first home for the current project.',
    path: '/',
  },
  {
    id: 'changes',
    label: 'Changes',
    eyebrow: 'Git activity',
    description: 'A focused view of work waiting for attention.',
    path: '/changes',
  },
  {
    id: 'review',
    label: 'Review',
    eyebrow: 'Agent work',
    description: 'A place to inspect a unit of work and its notes.',
    path: '/review',
  },
  {
    id: 'terminal',
    label: 'Terminal',
    eyebrow: 'Command line',
    description: 'A native entry point for saved actions and output.',
    path: '/terminal',
  },
]

export const POC_ITEMS: Record<PocSurfaceId, readonly PocItem[]> = {
  files: [
    { id: 'porcelain', label: 'porcelain', detail: 'Workspace root', state: 'active' },
    { id: 'apps', label: 'apps', detail: 'Application packages', state: 'ready' },
    { id: 'packages', label: 'packages', detail: 'Shared contracts', state: 'ready' },
    { id: 'agents', label: '.agents', detail: 'Agent guidance', state: 'ready' },
  ],
  changes: [
    { id: 'working-tree', label: 'Working tree', detail: '6 files changed', state: 'attention' },
    { id: 'staged', label: 'Staged', detail: 'Ready to review', state: 'ready' },
    { id: 'history', label: 'Recent history', detail: 'Latest commits', state: 'ready' },
  ],
  review: [
    { id: 'navigation-poc', label: 'Navigation POC', detail: 'In progress', state: 'active' },
    { id: 'notes', label: 'Review notes', detail: '2 annotations', state: 'attention' },
    { id: 'approved', label: 'Approved work', detail: 'Signed off', state: 'ready' },
  ],
  terminal: [
    { id: 'verify', label: 'pnpm verify', detail: 'Saved action', state: 'ready' },
    { id: 'tests', label: 'pnpm test', detail: 'Saved action', state: 'ready' },
    { id: 'last-run', label: 'Last run', detail: 'No live session in POC', state: 'attention' },
  ],
}

export function surfaceForPath(path: string): PocSurface {
  return POC_SURFACES.find((surface) => surface.path === path) ?? POC_SURFACES[0]
}

export function surfaceById(id: PocSurfaceId): PocSurface {
  return POC_SURFACES.find((surface) => surface.id === id) ?? POC_SURFACES[0]
}
