import type { CanvasBundleSource } from '../../features/projects'
import type { WorkspaceInventory } from './mcp-workspace'

/**
 * Exactly the operations the seven tools reach — a narrow port, not the whole
 * `DaemonOperations`. Structural, so the composition root's real catalog satisfies
 * it and a test can stand up only the calls under test without impersonating every
 * domain on the daemon.
 */
export type McpOperations = Readonly<{
  projects: Readonly<{
    listHubInventory: () => Promise<OperationResult<WorkspaceInventory>>
    listCanvases: (input: { projectId: string }) => Promise<OperationResult<unknown[]>>
    findCanvasByTemplate: (input: {
      projectId: string
      template: 'review'
    }) => Promise<OperationResult<string | null>>
    forgetCanvas: (input: { projectId: string; canvasId: string }) => Promise<OperationResult<void>>
    writeCanvas: (input: WriteCanvasArgs) => Promise<OperationResult<{ id: string; title: string }>>
    promoteCanvas: (input: {
      projectId: string
      canvasId: string
      path: string
    }) => Promise<OperationResult<{ bundlePath: string }>>
    promoteOverrides: (input: {
      projectId: string
      path: string
    }) => Promise<OperationResult<unknown>>
  }>
  review: Readonly<{
    listReviewComments: (input: {
      projectPath: string
    }) => Promise<OperationResult<readonly { id: string; resolved?: boolean }[]>>
    readReviewedPaths: (input: { projectPath: string }) => Promise<string[]>
    answerReviewComment: (input: {
      projectPath: string
      commentId: string
      body: string
    }) => Promise<OperationResult<undefined>>
  }>
  tasks: Readonly<{
    listTasks: () => Promise<
      OperationResult<readonly { id: string; shortId?: string; status: string }[]>
    >
    createTask: (
      input: TaskArgs & { title: string },
    ) => Promise<OperationResult<{ id: string; shortId?: string; title: string }>>
    updateTask: (
      input: TaskArgs & { taskId: string },
    ) => Promise<OperationResult<{ id: string; shortId?: string }>>
  }>
  actions: Readonly<{
    listActions: (input: { projectId: string }) => Promise<OperationResult<unknown[]>>
    addAction: (
      input: ActionArgs & { title: string; command: string },
    ) => Promise<OperationResult<{ id: string; title: string }>>
    updateAction: (input: ActionArgs & { id: string }) => Promise<OperationResult<unknown>>
    deleteAction: (input: { projectId: string; id: string }) => Promise<OperationResult<unknown>>
  }>
}>

type OperationResult<Value> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly error: unknown }

type WriteCanvasArgs = {
  projectId: string
  worktreeId: string | null
  id?: string
  title: string
  kind: 'html' | 'markdown'
  entryFile: string
  template?: 'review'
  source: CanvasBundleSource
}

type TaskArgs = {
  notes?: string
  status?: 'todo' | 'doing' | 'done' | 'blocked'
  tags?: string[]
  links?: { url: string; label: string }[]
  pathRefs?: { projectId: string; worktreeId: string; path: string; kind: 'file' | 'folder' }[]
  attachmentPaths?: string[]
  references?: { projectId: string; worktreeId?: string }
  title?: string
}

type ActionArgs = {
  authoredBy: 'agent'
  projectId: string
  title?: string
  command?: string
  where?: 'primary' | 'local'
}
