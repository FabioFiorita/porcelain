import type { ResolvedProfile, WorktreeProfile } from '@porcelain/contracts'
import type { ChangedFile, Commit } from '@porcelain/contracts/git'
import type { WorktreeProfileView } from '@porcelain/contracts/files'
import type { PromoteOverridesInput } from '@porcelain/contracts/projects'
import type { CanvasBundleSource } from '../../features/projects'
import type { ReviewComment } from '../../features/review/comment-capabilities'
import type { WorkspaceInventory } from './mcp-workspace'

/**
 * The MCP adapter reaches the same domain operations as the app. This port is
 * intentionally structural: tests can provide only the calls under test and the
 * composition root's real catalog satisfies it without a second implementation.
 */
export type McpOperations = Readonly<{
  git: Readonly<{
    statusGit: (repoPath: string) => Promise<OperationResult<ChangedFile[]>>
    logGit: (input: { repoPath: string; limit: number }) => Promise<Commit[]>
  }>
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
      author?: 'user' | 'agent'
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
  kind: 'html' | 'markdown' | 'structured'
  entryFile: string
  template?: 'review' | 'plan'
  source: CanvasBundleSource
}

export type ActionArgs = {
  authoredBy: 'agent'
  projectId: string
  title?: string
  command?: string
  where?: 'primary' | 'local'
  kind?: 'action' | 'worktree-setup' | 'worktree-dispose'
}
