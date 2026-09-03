import { isAbsolute, relative, resolve } from 'node:path'
import {
  decisionCanvasTemplateDataSchema,
  reviewCanvasTemplateDataSchema,
  structuredCanvasDocumentSchema,
  structuredCanvasValidationMessage,
} from '@porcelain/contracts/projects'
import { decisionBundleSource, reviewBundleSource, reviewDocumentBundleSource } from './mcp-canvas'
import type { McpToolHandlers, McpToolResult } from './mcp-dispatch'
import type { McpOperations } from './mcp-operations'
import {
  isWorkspaceRef,
  type ResolvedWorkspace,
  resolveWorkspace,
  type WorkspaceRef,
} from './mcp-workspace'

/** The MCP adapter calls domain operations; it never reaches into Porcelain storage. */
export type McpToolDeps = Readonly<{
  operations: McpOperations
}>

function ok(text: string): McpToolResult {
  return { text }
}

function fail(text: string): McpToolResult {
  return { text, isError: true }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringField(args: Record<string, unknown>, key: string): string | undefined {
  const value = args[key]
  return typeof value === 'string' && value !== '' ? value : undefined
}

function describeError(error: unknown): string {
  if (isRecord(error) && typeof error.code === 'string') return error.code
  return 'unknown'
}

function json(value: unknown): McpToolResult {
  return ok(JSON.stringify(value, null, 2))
}

function workspaceView(place: ResolvedWorkspace): Record<string, unknown> {
  return {
    projectId: place.projectId,
    worktreeId: place.worktreeId,
    path: place.worktreePath,
  }
}

function workspaceResult(place: ResolvedWorkspace, value: unknown): McpToolResult {
  return json({ workspace: workspaceView(place), value })
}

function statusOf(args: Record<string, unknown>): 'open' | 'resolved' | 'all' {
  return args.status === 'resolved' || args.status === 'all' ? args.status : 'open'
}

function repoRelativePaths(repoPath: string, value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0) return null
  const paths: string[] = []
  const seen = new Set<string>()
  for (const entry of value) {
    if (typeof entry !== 'string' || entry === '' || isAbsolute(entry)) return null
    const path = relative(repoPath, resolve(repoPath, entry)).replaceAll('\\', '/')
    if (path === '' || path === '..' || path.startsWith('../') || isAbsolute(path)) return null
    if (!seen.has(path)) {
      seen.add(path)
      paths.push(path)
    }
  }
  return paths
}

export function createMcpToolHandlers(deps: McpToolDeps): McpToolHandlers {
  const { operations } = deps

  async function resolvePlace(
    args: Record<string, unknown>,
  ): Promise<{ ok: true; value: ResolvedWorkspace } | { ok: false; result: McpToolResult }> {
    const ref = args.workspace
    if (!isWorkspaceRef(ref)) {
      return {
        ok: false,
        result: fail(
          'workspace is required: an absolute checkout path, or {projectId, worktreeId?}.',
        ),
      }
    }
    const inventory = await operations.projects.listHubInventory()
    if (!inventory.ok) return { ok: false, result: fail('This daemon cannot list its Projects.') }
    const resolved = await resolveWorkspace(ref as WorkspaceRef, inventory.value)
    return resolved.ok
      ? { ok: true, value: resolved.value }
      : { ok: false, result: fail(resolved.message) }
  }

  async function canvasSource(
    args: Record<string, unknown>,
    reviewCommitHash?: string,
  ): Promise<
    | {
        ok: true
        title: string
        kind: 'html' | 'markdown' | 'structured'
        entryFile: string
        template?: 'decision' | 'review'
        source: import('../../features/projects').CanvasBundleSource
      }
    | { ok: false; result: McpToolResult }
  > {
    if (args.document !== undefined) {
      if (
        args.templateData !== undefined ||
        args.template !== undefined ||
        args.files !== undefined ||
        args.kind !== undefined ||
        args.entry !== undefined ||
        args.title !== undefined
      ) {
        return {
          ok: false,
          result: fail(
            'document is a complete structured Canvas; do not combine it with title, kind, entry, files, template, or templateData.',
          ),
        }
      }
      const parsed = structuredCanvasDocumentSchema.safeParse(args.document)
      if (!parsed.success) {
        return {
          ok: false,
          result: fail(
            `Invalid structured Canvas: ${structuredCanvasValidationMessage(parsed.error)}.`,
          ),
        }
      }
      const entryFile = 'canvas.json'
      const assetsDir = stringField(args, 'sourceDir')
      return {
        ok: true,
        title: parsed.data.title,
        kind: 'structured',
        entryFile,
        template: parsed.data.template,
        source:
          parsed.data.template === 'review'
            ? reviewDocumentBundleSource(
                parsed.data,
                { layers: [], files: [] },
                reviewCommitHash,
                assetsDir,
              )
            : {
                kind: 'structured',
                entryFile,
                document: `${JSON.stringify(parsed.data, null, 2)}\n`,
                ...(assetsDir === undefined ? {} : { assetsDir }),
              },
      }
    }

    const templateData = args.templateData
    if (templateData !== undefined) {
      const template = args.template
      if (template !== 'decision' && template !== 'review') {
        return {
          ok: false,
          result: fail('template must be decision or review when templateData is provided.'),
        }
      }
      const schema =
        template === 'decision' ? decisionCanvasTemplateDataSchema : reviewCanvasTemplateDataSchema
      const parsed = schema.safeParse(templateData)
      if (!parsed.success) {
        return {
          ok: false,
          result: fail(
            `Invalid ${template} templateData: ${structuredCanvasValidationMessage(parsed.error)}.`,
          ),
        }
      }
      const source =
        template === 'decision'
          ? decisionBundleSource(decisionCanvasTemplateDataSchema.parse(parsed.data))
          : reviewBundleSource(
              reviewCanvasTemplateDataSchema.parse(parsed.data),
              reviewCommitHash,
              stringField(args, 'sourceDir'),
            )
      return {
        ok: true,
        title: parsed.data.title,
        kind: 'structured',
        entryFile: 'canvas.json',
        template,
        source,
      }
    }

    const title = stringField(args, 'title')
    const kind = args.kind === 'markdown' ? 'markdown' : args.kind === 'html' ? 'html' : undefined
    if (title === undefined || kind === undefined) {
      return { ok: false, result: fail('title and kind are required for a generic Canvas.') }
    }
    const entryFile = stringField(args, 'entry') ?? (kind === 'html' ? 'index.html' : 'index.md')
    const sourceDir = stringField(args, 'sourceDir')
    if (sourceDir !== undefined) {
      return { ok: true, title, kind, entryFile, source: { kind: 'directory', sourceDir } }
    }
    const files = Array.isArray(args.files)
      ? args.files.filter(isRecord).flatMap((file) => {
          if (typeof file.path !== 'string' || typeof file.content !== 'string') return []
          return [{ path: file.path, content: file.content }]
        })
      : []
    if (files.length === 0) {
      return {
        ok: false,
        result: fail('Canvas create/update needs sourceDir or a non-empty files array.'),
      }
    }
    return { ok: true, title, kind, entryFile, source: { kind: 'files', files } }
  }

  const tools: Record<
    string,
    (args: Record<string, unknown>, place: ResolvedWorkspace | null) => Promise<McpToolResult>
  > = {
    async porcelain_project(args) {
      const inventory = await operations.projects.listHubInventory()
      if (!inventory.ok) return fail(`Could not read Projects: ${describeError(inventory.error)}`)
      const projects = inventory.value.projects.map((project) => ({
        projectId: project.id,
        name: project.name,
        path: project.path,
        worktrees: project.worktrees.map((worktree) => ({
          worktreeId: worktree.id,
          name: worktree.name,
          branch: worktree.branch,
          path: worktree.path,
          isPrimary: worktree.isPrimary,
        })),
      }))
      if (args.op === 'list') return json({ projects })
      if (args.op !== 'get') return fail('op must be list or get.')
      const id =
        stringField(args, 'projectId') ??
        (isRecord(args.workspace) ? stringField(args.workspace, 'projectId') : undefined)
      if (id === undefined) return fail('projectId or workspace is required for project get.')
      const project = projects.find((entry) => entry.projectId === id)
      return project === undefined ? fail(`No Project ${id} on this daemon.`) : json(project)
    },

    async porcelain_canvas(args, place) {
      if (place === null) return fail('workspace is required for Canvas operations.')
      const op = args.op
      if (op === 'list') {
        const listed = await operations.projects.listCanvases({
          projectId: place.projectId,
          ...(place.worktreeId === null ? {} : { worktreeId: place.worktreeId }),
          ...(place.worktreePath === null ? {} : { worktreePath: place.worktreePath }),
        })
        return listed.ok
          ? workspaceResult(place, listed.value)
          : fail(`Could not list Canvases: ${describeError(listed.error)}`)
      }
      const id = stringField(args, 'id')
      if (op === 'get') {
        if (id === undefined) return fail('id is required to get a Canvas.')
        const read = await operations.projects.readCanvas({
          projectId: place.projectId,
          canvasId: id,
          ...(place.worktreePath === null ? {} : { worktreePath: place.worktreePath }),
        })
        return read.ok
          ? workspaceResult(place, read.value)
          : fail(`Could not read the Canvas: ${describeError(read.error)}`)
      }
      if (op === 'delete') {
        if (id === undefined) return fail('id is required to delete a Canvas.')
        const deleted = await operations.projects.forgetCanvas({
          projectId: place.projectId,
          canvasId: id,
          ...(place.worktreePath === null ? {} : { worktreePath: place.worktreePath }),
        })
        return deleted.ok
          ? ok(`Canvas ${id} deleted.`)
          : fail(`Could not delete the Canvas: ${describeError(deleted.error)}`)
      }
      if (op === 'promote') {
        if (id === undefined) return fail('id is required to promote a Canvas.')
        if (place.worktreePath === null)
          return fail('Canvas promotion needs a checkout on the daemon host.')
        const promoted = await operations.projects.promoteCanvas({
          projectId: place.projectId,
          canvasId: id,
          path: place.worktreePath,
        })
        return promoted.ok
          ? ok(
              `Canvas ${id} promoted to ${promoted.value.bundlePath}. Files written; nothing staged or committed.`,
            )
          : fail(`Could not promote the Canvas: ${describeError(promoted.error)}`)
      }
      if (op !== 'create' && op !== 'update')
        return fail('op must be list, get, create, update, delete, or promote.')
      const reviewCommitHash = await (async (): Promise<string | undefined> => {
        const isReview =
          args.template === 'review' ||
          (isRecord(args.document) && args.document.template === 'review')
        if (!isReview || place.worktreePath === null) return undefined
        try {
          const status = await operations.git.statusGit(place.worktreePath)
          if (!status.ok || status.value.length > 0) return undefined
          return (await operations.git.logGit({ repoPath: place.worktreePath, limit: 1 }))[0]?.hash
        } catch {
          return undefined
        }
      })()
      const source = await canvasSource(args, reviewCommitHash)
      if (!source.ok) return source.result
      const canvasId = stringField(args, 'id')
      if (op === 'create' && canvasId !== undefined)
        return fail('id is not accepted for create; use update to replace a Canvas.')
      if (op === 'update' && canvasId === undefined)
        return fail('id is required to update a Canvas.')
      const listed = await operations.projects.listCanvases({
        projectId: place.projectId,
        ...(place.worktreeId === null ? {} : { worktreeId: place.worktreeId }),
        ...(place.worktreePath === null ? {} : { worktreePath: place.worktreePath }),
      })
      const wasTracked =
        canvasId !== undefined &&
        listed.ok &&
        listed.value.some(
          (record) => isRecord(record) && record.id === canvasId && record.tracked === true,
        )
      const written = await operations.projects.writeCanvas({
        projectId: place.projectId,
        worktreeId: place.worktreeId,
        ...(canvasId === undefined ? {} : { id: canvasId }),
        title: source.title,
        kind: source.kind,
        entryFile: source.entryFile,
        ...(source.template === undefined ? {} : { template: source.template }),
        source: source.source,
      })
      if (!written.ok) return fail(`Could not write the Canvas: ${describeError(written.error)}`)
      const track = args.tracked === true || wasTracked
      if (track) {
        if (place.worktreePath === null)
          return fail('tracked Canvas writes need a checkout on the daemon host.')
        // A template create can resolve an existing tracked Canvas too. In both
        // that case and an ordinary update, replace the canonical bytes instead
        // of letting idempotent promotion leave a fresh private duplicate behind.
        const replacing = canvasId !== undefined && (args.tracked === true || wasTracked)
        const promoted = await operations.projects.promoteCanvas({
          projectId: place.projectId,
          canvasId: written.value.id,
          path: place.worktreePath,
          ...(replacing ? { replace: true } : {}),
        })
        return promoted.ok
          ? ok(
              source.template === 'review'
                ? `Review Canvas ${written.value.id} written to the tracked overlay${reviewCommitHash === undefined ? ' for live Changes; update it after committing to bind History' : ` and bound to commit ${reviewCommitHash} for History`}. Files written; nothing staged or committed.`
                : `Canvas ${written.value.id} written to the tracked overlay. Files written; nothing staged or committed.`,
            )
          : fail(`Could not update the tracked Canvas: ${describeError(promoted.error)}`)
      }
      return workspaceResult(
        place,
        source.template === 'review'
          ? {
              ...written.value,
              historyCommit: reviewCommitHash ?? null,
              history:
                reviewCommitHash === undefined
                  ? 'live-only; update this Canvas after committing to bind History'
                  : 'bound',
            }
          : written.value,
      )
    },

    async porcelain_comment(args, place) {
      if (place?.worktreePath === null || place === null)
        return fail('Comments need a checkout on the daemon host.')
      const projectPath = place.worktreePath
      const op = args.op
      if (op === 'list' || op === 'get') {
        const listed = await operations.review.listReviewComments({ projectPath })
        if (!listed.ok) return fail(`Could not list comments: ${describeError(listed.error)}`)
        const status = statusOf(args)
        const filtered = listed.value.filter(
          (comment) =>
            status === 'all' || (status === 'resolved' ? comment.resolved : !comment.resolved),
        )
        if (op === 'list') return workspaceResult(place, filtered)
        const id = stringField(args, 'id')
        if (id === undefined) return fail('id is required to get a comment.')
        const comment = listed.value.find((entry) => entry.id === id)
        return comment === undefined ? fail(`No comment ${id}.`) : workspaceResult(place, comment)
      }
      const id = stringField(args, 'id')
      if (op === 'create') {
        const comment = isRecord(args.comment) ? args.comment : args
        const path = typeof comment.path === 'string' ? comment.path : undefined
        const body = typeof comment.body === 'string' ? comment.body : undefined
        if (path === undefined || body === undefined)
          return fail('comment.path and comment.body are required to create a comment.')
        const created = await operations.review.addReviewComment({
          projectPath,
          author: 'agent',
          path,
          body,
          ...(typeof comment.startLine === 'number' ? { startLine: comment.startLine } : {}),
          ...(typeof comment.endLine === 'number' ? { endLine: comment.endLine } : {}),
          ...(typeof comment.anchorText === 'string' ? { anchorText: comment.anchorText } : {}),
        })
        return created.ok
          ? workspaceResult(place, created.value)
          : fail(`Could not create the comment: ${describeError(created.error)}`)
      }
      if (id === undefined) return fail('id is required for this comment operation.')
      if (op === 'update' || op === 'reply') {
        const body = stringField(args, 'body')
        if (body === undefined) return fail('body is required for comment update/reply.')
        const changed =
          op === 'update'
            ? await operations.review.editReviewComment({ projectPath, commentId: id, body })
            : await operations.review.answerReviewComment({ projectPath, commentId: id, body })
        return changed.ok
          ? ok(op === 'reply' ? `Reply posted under comment ${id}.` : `Comment ${id} updated.`)
          : fail(`Could not ${op} the comment: ${describeError(changed.error)}`)
      }
      if (op === 'delete') {
        const deleted = await operations.review.deleteReviewComment({ projectPath, commentId: id })
        return deleted.ok
          ? ok(`Comment ${id} deleted.`)
          : fail(`Could not delete the comment: ${describeError(deleted.error)}`)
      }
      if (op === 'resolve' || op === 'reopen') {
        const changed = await operations.review.resolveReviewComment({
          projectPath,
          commentId: id,
          resolved: op === 'resolve',
        })
        return changed.ok
          ? ok(`Comment ${id} ${op === 'resolve' ? 'resolved' : 'reopened'}.`)
          : fail(`Could not ${op} the comment: ${describeError(changed.error)}`)
      }
      return fail('op must be list, get, create, update, delete, reply, resolve, or reopen.')
    },

    async porcelain_review(args, place) {
      if (place?.worktreePath === null || place === null)
        return fail('Reviewed state needs a checkout on the daemon host.')
      const projectPath = place.worktreePath
      if (args.op === 'get-reviewed') {
        return workspaceResult(place, await operations.review.readReviewedPaths({ projectPath }))
      }
      if (args.op === 'mark' || args.op === 'unmark') {
        const paths = repoRelativePaths(projectPath, args.paths)
        if (paths === null)
          return fail('paths must be a non-empty list of repository-relative paths.')
        if (args.op === 'mark') {
          const status = await operations.git.statusGit(projectPath)
          if (!status.ok)
            return fail(`Could not read changed files: ${describeError(status.error)}`)
          const changedPaths = new Set(status.value.map((file) => file.path))
          const unchanged = paths.filter((path) => !changedPaths.has(path))
          if (unchanged.length > 0) {
            return fail(`Only changed files can be marked reviewed: ${unchanged.join(', ')}.`)
          }
        }
        await operations.review.setReviewed({
          projectPath,
          paths,
          reviewed: args.op === 'mark',
        })
        return workspaceResult(place, {
          reviewed: args.op === 'mark',
          paths,
        })
      }
      return fail('op must be get-reviewed, mark, or unmark.')
    },

    async porcelain_profile(args, place) {
      if (place?.worktreePath === null || place === null)
        return fail('Profiles need a checkout on the daemon host.')
      const level = args.level
      const op = args.op
      if (level !== 'project')
        return fail('Only the project navigation profile remains persistent.')
      if (op === 'get') {
        const view = await operations.files.worktreeProfile(place.worktreePath)
        return workspaceResult(place, {
          pinnedPaths: view.base.pinnedPaths,
          hiddenPaths: view.base.hiddenPaths,
        })
      }
      if (op === 'pin' || op === 'unpin' || op === 'hide' || op === 'unhide') {
        const paths = repoRelativePaths(place.worktreePath, [args.path])
        if (paths === null)
          return fail('path must be a repository-relative path that stays inside the checkout.')
        const path = paths[0]
        if (path === undefined) return fail('path is required for this profile operation.')
        if (op === 'pin') await operations.files.pinPath(place.worktreePath, path)
        else if (op === 'unpin') await operations.files.unpinPath(place.worktreePath, path)
        else if (op === 'hide') await operations.files.hidePath(place.worktreePath, path)
        else await operations.files.unhidePath(place.worktreePath, path)
        return workspaceResult(place, { operation: op, path })
      }
      if (op === 'promote') {
        if (level !== 'project')
          return fail('Only the project profile has portable fields to promote.')
        const view = await operations.files.worktreeProfile(place.worktreePath)
        const promoted = await operations.projects.promoteOverrides({
          projectId: place.projectId,
          path: place.worktreePath,
          hiddenPaths: [...new Set(view.base.hiddenPaths)],
          pinnedPaths: [...new Set(view.base.pinnedPaths)],
        })
        return promoted.ok
          ? ok('Project profile pins and hides promoted to .porcelain/project.json.')
          : fail(`Could not promote the profile: ${describeError(promoted.error)}`)
      }
      return fail('op must be get, pin, unpin, hide, unhide, or promote.')
    },

    async porcelain_action(args, place) {
      if (place === null) return fail('workspace is required for Action operations.')
      const listed = await operations.actions.listActions({ projectId: place.projectId })
      if (!listed.ok) return fail(`Could not list Actions: ${describeError(listed.error)}`)
      const op = args.op
      if (op === 'list') return workspaceResult(place, listed.value)
      const id = stringField(args, 'id')
      if (op === 'get') {
        if (id === undefined) return fail('id is required to get an Action.')
        const action = listed.value.find((entry) => isRecord(entry) && entry.id === id)
        return action === undefined ? fail(`No Action ${id}.`) : workspaceResult(place, action)
      }
      if (id !== undefined && op === 'delete') {
        const deleted = await operations.actions.deleteAction({ projectId: place.projectId, id })
        return deleted.ok
          ? ok(`Action ${id} deleted.`)
          : fail(`Could not delete the Action: ${describeError(deleted.error)}`)
      }
      if (op === 'create') {
        const title = stringField(args, 'title')
        const command = stringField(args, 'command')
        if (title === undefined || command === undefined)
          return fail('title and command are required to create an Action.')
        const created = await operations.actions.addAction({
          authoredBy: 'agent',
          projectId: place.projectId,
          title,
          command,
          ...(args.where === 'primary' || args.where === 'local' ? { where: args.where } : {}),
          ...(args.kind === 'action' ||
          args.kind === 'worktree-setup' ||
          args.kind === 'worktree-dispose'
            ? { kind: args.kind }
            : {}),
        })
        return created.ok
          ? workspaceResult(place, created.value)
          : fail(`Could not create the Action: ${describeError(created.error)}`)
      }
      if (op === 'update') {
        if (id === undefined) return fail('id is required to update an Action.')
        const updated = await operations.actions.updateAction({
          authoredBy: 'agent',
          projectId: place.projectId,
          id,
          ...(stringField(args, 'title') === undefined
            ? {}
            : { title: stringField(args, 'title') }),
          ...(stringField(args, 'command') === undefined
            ? {}
            : { command: stringField(args, 'command') }),
          ...(args.where === 'primary' || args.where === 'local' ? { where: args.where } : {}),
        })
        return updated.ok
          ? ok(`Action ${id} updated.`)
          : fail(`Could not update the Action: ${describeError(updated.error)}`)
      }
      return fail(
        'op must be list, get, create, update, or delete. Actions cannot be run or trusted through MCP.',
      )
    },
  }

  return {
    async call(name, args) {
      const tool = tools[name]
      if (tool === undefined) return fail(`Unknown tool ${name}.`)
      if (name === 'porcelain_project') return tool(args, null)
      const resolved = await resolvePlace(args)
      if (!resolved.ok) return resolved.result
      return tool(args, resolved.value)
    },
  }
}
