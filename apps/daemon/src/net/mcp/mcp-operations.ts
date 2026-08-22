import type { CanvasBundleSource } from '../../features/projects'
import type { ResolvedProfile, WorktreeProfile } from '@porcelain/contracts'
import type { WorktreeProfileView } from '@porcelain/contracts/files'
import type { PromoteOverridesInput } from '@porcelain/contracts/projects'
import type { ReviewComment } from '../../features/review/comment-capabilities'
import type { WorkspaceInventory } from './mcp-workspace'

/**
 * The MCP adapter reaches the same domain operations as the app. This port is
 * intentionally structural: tests can provide only the calls under test and the
 * composition root's real catalog satisfies it without a second implementation.
 */
export type McpOperations = Readonly<{
  files: Readonly<{
    worktreeProfile: (repoPath: string) => Promise<WorktreeProfileView>
    setProjectProfile: (repoPath: string, profile: ResolvedProfile) => Promise<void>
    setWorktreeProfile: (repoPath: string, profile: WorktreeProfile | null) => Promise<void>
  }>
  projects: Readonly<{
    listHubInventory: () => Promise<OperationResult<WorkspaceInventory>>
    listCanvases: (input: {
      projectId: string
      worktreePath?: string
    }) => Promise<OperationResult<readonly unknown[]>>
    findCanvasByTemplate: (input: {
      projectId: string
      template: 'review'
      worktreePath?: string
    }) => Promise<OperationResult<string | null>>
    readCanvas: (input: {
      projectId: string
      canvasId: string
      worktreePath?: string
    }) => Promise<OperationResult<{ record: unknown; content: string }>>
    forgetCanvas: (input: {
      projectId: string
      canvasId: string
      worktreePath?: string
    }) => Promise<OperationResult<void>>
    writeCanvas: (input: WriteCanvasArgs) => Promise<OperationResult<CanvasWriteResult>>
    promoteCanvas: (input: {
      projectId: string
      canvasId: string
      path: string
      /** Internal agent-surface mode: replace an existing tracked bundle from its private update. */
      replace?: boolean
    }) => Promise<OperationResult<{ bundlePath: string }>>
    promoteOverrides: (input: PromoteOverridesInput) => Promise<OperationResult<unknown>>
  }>
  review: Readonly<{
    listReviewComments: (input: {
      projectPath: string
    }) => Promise<OperationResult<readonly ReviewComment[]>>
    addReviewComment: (input: {
      projectPath: string
      path: string
      startLine?: number
      endLine?: number
      anchorText?: string
      body: string
    }) => Promise<OperationResult<ReviewComment>>
    editReviewComment: (input: {
      projectPath: string
      commentId: string
      body: string
    }) => Promise<OperationResult<void>>
    answerReviewComment: (input: {
      projectPath: string
      commentId: string
      body: string
    }) => Promise<OperationResult<void>>
    deleteReviewComment: (input: {
      projectPath: string
      commentId: string
    }) => Promise<OperationResult<void>>
    resolveReviewComment: (input: {
      projectPath: string
      commentId: string
      resolved: boolean
    }) => Promise<OperationResult<void>>
  }>
  tasks: Readonly<{
    listTasks: () => Promise<OperationResult<readonly McpTask[]>>
    createTask: (input: TaskArgs & { title: string }) => Promise<OperationResult<McpTask>>
    updateTask: (input: TaskArgs & { taskId: string }) => Promise<OperationResult<McpTask>>
    deleteTask: (input: { taskId: string }) => Promise<OperationResult<{ taskId: string }>>
  }>
  actions: Readonly<{
    listActions: (input: { projectId: string }) => Promise<OperationResult<readonly unknown[]>>
    addAction: (
      input: ActionArgs & { title: string; command: string },
    ) => Promise<OperationResult<unknown>>
    updateAction: (input: ActionArgs & { id: string }) => Promise<OperationResult<unknown>>
    deleteAction: (input: { projectId: string; id: string }) => Promise<OperationResult<unknown>>
  }>
}>

export type OperationResult<Value> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly error: unknown }

export type CanvasWriteResult = Readonly<{
  id: string
  title: string
  tracked?: boolean
}>

export type WriteCanvasArgs = {
  projectId: string
  worktreeId: string | null
  id?: string
  title: string
  kind: 'html' | 'markdown'
  entryFile: string
  template?: 'review'
  source: CanvasBundleSource
}

export type McpTask = Readonly<{
  id: string
  shortId?: string
  title?: string
  notes?: string
  status: string
  tags?: readonly string[]
  links?: readonly { url: string; label?: string }[]
  pathRefs?: readonly { projectId: string; worktreeId: string; path: string; kind: string }[]
  attachments?: readonly { id: string; name: string; storedPath: string; mime?: string }[]
  references?: { projectId?: string; worktreeId?: string }
  updatedAt?: string
}>

export type TaskArgs = {
  title?: string
  notes?: string
  status?: 'todo' | 'doing' | 'done' | 'blocked'
  tags?: string[]
  links?: { url: string; label: string }[]
  pathRefs?: { projectId: string; worktreeId: string; path: string; kind: 'file' | 'folder' }[]
  attachmentPaths?: string[]
  removeAttachmentIds?: string[]
  references?: { projectId: string; worktreeId?: string }
}

export type ActionArgs = {
  authoredBy: 'agent'
  projectId: string
  title?: string
  command?: string
  where?: 'primary' | 'local'
  kind?: 'action' | 'worktree-setup' | 'worktree-dispose'
}
