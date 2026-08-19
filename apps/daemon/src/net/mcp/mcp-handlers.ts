import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { resolvedProfileSchema, worktreeProfileSchema } from '@porcelain/contracts'
import type { McpToolHandlers, McpToolResult } from './mcp-dispatch'
import type { McpOperations, McpTask } from './mcp-operations'
import { describeMissingTask, mergeLink, taskMatches, taskView } from './mcp-tasks'
import {
  mergeReviewFiles,
  parseReviewSet,
  REVIEW_CANVAS_METADATA,
  type ReviewFile,
  type ReviewSection,
  type ReviewSet,
  reviewBundleSource,
} from './mcp-review'
import {
  isWorkspaceRef,
  type ResolvedWorkspace,
  resolveWorkspace,
  type WorkspaceRef,
} from './mcp-workspace'

/**
 * The tools, over the same operations the app calls.
 *
 * An adapter, not a second implementation: every product decision stays in the
 * operation, which is what stops the agent surface drifting from the human one the
 * way the CLI did once it started writing $PORCELAIN_HOME itself.
 *
 * Failures come back as tool RESULTS carrying text, not JSON-RPC errors. A model is
 * meant to read what went wrong and try again; a transport error denies it that and
 * usually ends the turn.
 */

export type McpToolDeps = Readonly<{
  operations: McpOperations
  /** Where the daemon keeps Canvas bundles — the Review's metadata is read from disk. */
  canvasBundleDir: (projectId: string, canvasId: string) => string
  /**
   * Absolute path of a stored Task attachment on the DAEMON host.
   *
   * The tRPC contract refuses to carry host paths, and it is right to: a browser has
   * no business reading the daemon's disk. An agent on the daemon host is the other
   * case — it has a file reader, and a screenshot it cannot open is a screenshot the
   * human has to describe out loud. So the path is composed here, on the tool wire,
   * and labelled as host-local.
   */
  attachmentPath: (storedPath: string) => string
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

function stringList(args: Record<string, unknown>, key: string): string[] | undefined {
  const value = args[key]
  if (!Array.isArray(value)) return undefined
  const entries = value.filter(
    (entry): entry is string => typeof entry === 'string' && entry !== '',
  )
  return entries.length === 0 ? undefined : entries
}

/** Describe an operation failure without leaking a daemon-internal error object. */
function describeError(error: unknown): string {
  if (isRecord(error) && typeof error.code === 'string') return error.code
  return 'unknown'
}

export function createMcpToolHandlers(deps: McpToolDeps): McpToolHandlers {
  const { operations } = deps

  async function workspace(
    args: Record<string, unknown>,
  ): Promise<{ ok: true; value: ResolvedWorkspace } | { ok: false; result: McpToolResult }> {
    const ref = args.workspace
    if (!isWorkspaceRef(ref)) {
      return {
        ok: false,
        result: fail('workspace is required: an absolute path in the checkout, or {projectId}.'),
      }
    }
    const inventory = await operations.projects.listHubInventory()
    if (!inventory.ok) return { ok: false, result: fail('This daemon cannot list its Projects.') }
    const resolved = await resolveWorkspace(ref as WorkspaceRef, inventory.value)
    return resolved.ok
      ? { ok: true, value: resolved.value }
      : { ok: false, result: fail(resolved.message) }
  }

  /** The Review is the Canvas carrying the `review` template; there is at most one. */
  async function reviewCanvasId(place: ResolvedWorkspace): Promise<string | undefined> {
    const found = await operations.projects.findCanvasByTemplate({
      projectId: place.projectId,
      template: 'review',
    })
    return found.ok && found.value !== null ? found.value : undefined
  }

  async function readReviewSet(place: ResolvedWorkspace): Promise<ReviewSet | null> {
    const id = await reviewCanvasId(place)
    if (id === undefined) return null
    try {
      const raw = await readFile(
        join(deps.canvasBundleDir(place.projectId, id), REVIEW_CANVAS_METADATA),
        'utf8',
      )
      return parseReviewSet(JSON.parse(raw))
    } catch {
      return null
    }
  }

  async function publishReview(place: ResolvedWorkspace, set: ReviewSet): Promise<McpToolResult> {
    const rendered = reviewBundleSource(set)
    const written = await operations.projects.writeCanvas({
      projectId: place.projectId,
      worktreeId: place.worktreeId,
      id: await reviewCanvasId(place),
      title: set.name,
      kind: rendered.kind,
      entryFile: rendered.entryFile,
      template: 'review',
      source: rendered.source,
    })
    if (!written.ok) return fail(`Could not publish the Review: ${describeError(written.error)}`)
    return ok(
      `Review "${set.name}" published — ${set.files.length} file(s), ${set.sections.length} section(s).`,
    )
  }

  /** Short ids are what the human says out loud ("mark T-1 doing"); updateTask takes a UUID. */
  async function resolveTaskIds(
    wanted: readonly string[],
  ): Promise<{ ok: true; value: string[] } | { ok: false; result: McpToolResult }> {
    const listed = await operations.tasks.listTasks()
    if (!listed.ok) return { ok: false, result: fail('This daemon cannot list its Tasks.') }
    const resolvedIds: string[] = []
    for (const entry of wanted) {
      const found = listed.value.find((task) => taskMatches(task, entry))
      if (found === undefined) {
        return { ok: false, result: fail(describeMissingTask(entry, listed.value)) }
      }
      resolvedIds.push(found.id)
    }
    return { ok: true, value: resolvedIds }
  }

  async function readTask(taskId: string): Promise<McpTask | undefined> {
    const listed = await operations.tasks.listTasks()
    return listed.ok ? listed.value.find((task) => task.id === taskId) : undefined
  }

  const tools: Record<
    string,
    (args: Record<string, unknown>, place: ResolvedWorkspace) => Promise<McpToolResult>
  > = {
    async porcelain_context(args, place) {
      const requested = Array.isArray(args.include)
        ? args.include.filter((entry): entry is string => typeof entry === 'string')
        : ['review', 'comments', 'marks']
      const out: Record<string, unknown> = {
        workspace: {
          projectId: place.projectId,
          worktreeId: place.worktreeId,
          path: place.worktreePath,
        },
      }

      if (requested.includes('review')) out.review = await readReviewSet(place)
      if (requested.includes('comments') && place.worktreePath !== null) {
        const comments = await operations.review.listReviewComments({
          projectPath: place.worktreePath,
        })
        // The human's comments are the point of the whole product; resolved ones are
        // noise to an agent that is about to act, so only the open ones come back.
        out.comments = comments.ok ? comments.value.filter((comment) => !comment.resolved) : []
      }
      if (requested.includes('marks') && place.worktreePath !== null) {
        out.reviewedPaths = await operations.review.readReviewedPaths({
          projectPath: place.worktreePath,
        })
      }
      if (requested.includes('tasks')) {
        const tasks = await operations.tasks.listTasks()
        const taskId = stringField(args, 'taskId')
        const includeDone = args.includeDone === true
        if (tasks.ok) {
          const rows =
            taskId === undefined
              ? tasks.value.filter((task) => includeDone || task.status !== 'done')
              : tasks.value.filter((task) => taskMatches(task, taskId))
          out.tasks = rows.map((task) => taskView(task, deps.attachmentPath))
          if (taskId === undefined && !includeDone) {
            out.tasksNote = 'Done Tasks are hidden. Pass includeDone: true for the whole board.'
          }
        } else out.tasks = []
      }
      if (requested.includes('projects')) {
        const inventory = await operations.projects.listHubInventory()
        out.projects = !inventory.ok
          ? []
          : inventory.value.projects.map((project) => ({
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
      }
      if (requested.includes('actions')) {
        const actions = await operations.actions.listActions({ projectId: place.projectId })
        out.actions = actions.ok ? actions.value : []
      }
      if (requested.includes('canvases')) {
        const canvases = await operations.projects.listCanvases({ projectId: place.projectId })
        out.canvases = canvases.ok ? canvases.value : []
      }
      return ok(JSON.stringify(out, null, 2))
    },

    async porcelain_profile(args, place) {
      if (place.worktreePath === null)
        return fail('Profiles require a checkout on the daemon host.')
      const level = args.level
      const op = args.op
      if (
        (level !== 'project' && level !== 'worktree') ||
        !['get', 'set', 'clear'].includes(String(op))
      ) {
        return fail('level must be project or worktree; op must be get, set, or clear.')
      }
      if (op === 'get') {
        const view = await operations.files.worktreeProfile(place.worktreePath)
        return ok(JSON.stringify(level === 'project' ? view.base : view.override, null, 2))
      }
      if (op === 'clear') {
        if (level === 'project') {
          await operations.files.setProjectProfile(place.worktreePath, {
            pinnedPaths: [],
            hiddenPaths: [],
            layers: [],
          })
        } else await operations.files.setWorktreeProfile(place.worktreePath, null)
        return ok(`${level === 'project' ? 'Project profile' : 'Worktree override'} cleared.`)
      }
      if (level === 'project') {
        const parsed = resolvedProfileSchema.safeParse(args.profile)
        if (!parsed.success)
          return fail(
            `Invalid project profile: ${parsed.error.issues[0]?.message ?? 'invalid input'}.`,
          )
        await operations.files.setProjectProfile(place.worktreePath, parsed.data)
      } else {
        const parsed = worktreeProfileSchema.safeParse(args.profile)
        if (!parsed.success)
          return fail(
            `Invalid worktree profile: ${parsed.error.issues[0]?.message ?? 'invalid input'}.`,
          )
        await operations.files.setWorktreeProfile(place.worktreePath, parsed.data)
      }
      return ok(`${level === 'project' ? 'Project profile' : 'Worktree override'} replaced.`)
    },

    async porcelain_review(args, place) {
      const mode = args.mode
      if (mode === 'clear') {
        const id = await reviewCanvasId(place)
        if (id === undefined) return ok('No Review to clear.')
        const cleared = await operations.projects.forgetCanvas({
          projectId: place.projectId,
          canvasId: id,
        })
        return cleared.ok
          ? ok('Review cleared.')
          : fail(`Could not clear the Review: ${describeError(cleared.error)}`)
      }

      const files = Array.isArray(args.files) ? (args.files as ReviewFile[]) : []
      const sections = Array.isArray(args.sections) ? (args.sections as ReviewSection[]) : []

      if (mode === 'append') {
        const current = await readReviewSet(place)
        if (current === null) {
          return fail('There is no Review to append to. Publish one with mode "replace" first.')
        }
        return publishReview(place, { ...current, files: mergeReviewFiles(current.files, files) })
      }

      const name = stringField(args, 'name') ?? 'Active review'
      const thesis = stringField(args, 'thesis')
      return publishReview(place, {
        name,
        files,
        sections,
        ...(thesis === undefined ? {} : { thesis }),
      })
    },

    async porcelain_task(args, place) {
      const status = args.status
      const tags = stringList(args, 'tags')
      const link = stringField(args, 'link')
      const replacementLinks = Array.isArray(args.links)
        ? args.links
            .filter(isRecord)
            .filter((entry) => typeof entry.url === 'string' && entry.url !== '')
            .map((entry) => ({
              url: String(entry.url),
              label:
                typeof entry.label === 'string' && entry.label !== ''
                  ? entry.label
                  : String(entry.url),
            }))
        : undefined
      const attach = stringField(args, 'attach')
      const file = stringField(args, 'file')
      const folder = stringField(args, 'folder')
      const pathRefs =
        place.worktreeId === null
          ? undefined
          : [
              ...(file === undefined
                ? []
                : [
                    {
                      projectId: place.projectId,
                      worktreeId: place.worktreeId,
                      path: file,
                      kind: 'file' as const,
                    },
                  ]),
              ...(folder === undefined
                ? []
                : [
                    {
                      projectId: place.projectId,
                      worktreeId: place.worktreeId,
                      path: folder,
                      kind: 'folder' as const,
                    },
                  ]),
            ]

      const common = {
        ...(stringField(args, 'notes') === undefined ? {} : { notes: stringField(args, 'notes') }),
        ...(typeof status === 'string' ? { status: status as 'todo' } : {}),
        ...(tags === undefined ? {} : { tags }),
        ...(pathRefs === undefined || pathRefs.length === 0 ? {} : { pathRefs }),
        ...(attach === undefined ? {} : { attachmentPaths: [attach] }),
      }

      const wanted =
        stringList(args, 'ids') ??
        (stringField(args, 'id') === undefined ? [] : [String(stringField(args, 'id'))])

      if (wanted.length === 0) {
        const title = stringField(args, 'title')
        if (title === undefined) {
          return fail('title is required to create a Task. Pass id (or ids) to update instead.')
        }
        const newLinks =
          replacementLinks ??
          (link === undefined
            ? undefined
            : [{ url: link, label: stringField(args, 'linkLabel') ?? link }])
        const created = await operations.tasks.createTask({
          title,
          references: {
            projectId: place.projectId,
            ...(place.worktreeId === null ? {} : { worktreeId: place.worktreeId }),
          },
          ...common,
          ...(newLinks === undefined ? {} : { links: newLinks }),
        })
        return created.ok
          ? ok(`Task ${created.value.shortId ?? created.value.id} created: ${created.value.title}`)
          : fail(`Could not create the Task: ${describeError(created.error)}`)
      }

      const resolved = await resolveTaskIds(wanted)
      if (!resolved.ok) return resolved.result

      const title = stringField(args, 'title')
      if (title !== undefined && resolved.value.length > 1) {
        return fail('title cannot be applied to several Tasks at once — update them one at a time.')
      }

      const done: string[] = []
      for (const taskId of resolved.value) {
        // A single `link` ADDS: attaching a PR to a Task that already links its issue
        // must not silently drop the issue. `links` is the explicit replace.
        let links = replacementLinks
        if (links === undefined && link !== undefined) {
          const current = await readTask(taskId)
          links = mergeLink(current?.links, {
            url: link,
            label: stringField(args, 'linkLabel') ?? link,
          })
        }
        const updated = await operations.tasks.updateTask({
          taskId,
          ...(title === undefined ? {} : { title }),
          ...common,
          ...(links === undefined ? {} : { links }),
        })
        if (!updated.ok) return fail(`Could not update the Task: ${describeError(updated.error)}`)
        done.push(updated.value.shortId ?? updated.value.id)
      }
      return ok(`Task${done.length > 1 ? 's' : ''} ${done.join(', ')} updated.`)
    },

    async porcelain_action(args, place) {
      const id = stringField(args, 'id')
      if (args.op === 'delete') {
        if (id === undefined) return fail('id is required to delete an Action.')
        const deleted = await operations.actions.deleteAction({ projectId: place.projectId, id })
        return deleted.ok
          ? ok('Action deleted.')
          : fail(`Could not delete the Action: ${describeError(deleted.error)}`)
      }

      const where = args.where === 'local' || args.where === 'primary' ? args.where : undefined
      const command = stringField(args, 'command')
      const title = stringField(args, 'title')

      if (id === undefined) {
        if (title === undefined || command === undefined) {
          return fail('title and command are required to create an Action.')
        }
        const created = await operations.actions.addAction({
          authoredBy: 'agent',
          projectId: place.projectId,
          title,
          command,
          ...(where === undefined ? {} : { where }),
        })
        return created.ok
          ? ok(
              `Action "${created.value.title}" saved. It is UNTRUSTED — the human approves the command before it can run.`,
            )
          : fail(`Could not save the Action: ${describeError(created.error)}`)
      }

      const updated = await operations.actions.updateAction({
        authoredBy: 'agent',
        projectId: place.projectId,
        id,
        ...(title === undefined ? {} : { title }),
        ...(command === undefined ? {} : { command }),
        ...(where === undefined ? {} : { where }),
      })
      return updated.ok
        ? ok(
            command === undefined
              ? 'Action updated.'
              : 'Action updated. The changed command is UNTRUSTED until the human approves it.',
          )
        : fail(`Could not update the Action: ${describeError(updated.error)}`)
    },

    async porcelain_canvas(args, place) {
      const title = stringField(args, 'title')
      const sourceDir = stringField(args, 'sourceDir')
      const kind = args.kind === 'markdown' ? 'markdown' : 'html'
      if (title === undefined || sourceDir === undefined) {
        return fail('title and sourceDir are required.')
      }
      const entry = stringField(args, 'entry') ?? (kind === 'html' ? 'index.html' : 'index.md')
      const written = await operations.projects.writeCanvas({
        projectId: place.projectId,
        worktreeId: place.worktreeId,
        ...(stringField(args, 'id') === undefined ? {} : { id: stringField(args, 'id') }),
        title,
        kind,
        entryFile: entry,
        source: { kind: 'directory', sourceDir },
      })
      return written.ok
        ? ok(`Canvas ${written.value.id} "${written.value.title}" published.`)
        : fail(`Could not publish the Canvas: ${describeError(written.error)}`)
    },

    async porcelain_promote(args, place) {
      const target = stringField(args, 'target') ?? place.worktreePath
      if (target === null || target === undefined) {
        return fail('This workspace has no checkout on disk; pass target explicitly.')
      }
      if (args.what === 'overrides') {
        const promoted = await operations.projects.promoteOverrides({
          projectId: place.projectId,
          path: target,
        })
        return promoted.ok
          ? ok(`Overrides promoted into ${target}.`)
          : fail(`Could not promote: ${describeError(promoted.error)}`)
      }
      const canvasId = stringField(args, 'canvasId')
      if (canvasId === undefined) return fail('canvasId is required when promoting a Canvas.')
      const promoted = await operations.projects.promoteCanvas({
        projectId: place.projectId,
        canvasId,
        path: target,
      })
      return promoted.ok
        ? ok(
            `Canvas promoted to ${promoted.value.bundlePath}. Files written; nothing staged or committed.`,
          )
        : fail(`Could not promote: ${describeError(promoted.error)}`)
    },

    async porcelain_reply(args, place) {
      if (place.worktreePath === null) return fail('Replying needs a checkout on disk.')
      const commentId = stringField(args, 'commentId')
      const body = stringField(args, 'body')
      if (commentId === undefined || body === undefined) {
        return fail('commentId and body are required.')
      }
      const answered = await operations.review.answerReviewComment({
        projectPath: place.worktreePath,
        commentId,
        body,
      })
      return answered.ok
        ? ok('Reply posted under the comment. Only the human can resolve it.')
        : fail(`Could not reply: ${describeError(answered.error)}`)
    },
  }

  return {
    async call(name, args) {
      const tool = tools[name]
      if (tool === undefined) return fail(`Unknown tool ${name}.`)
      const place = await workspace(args)
      if (!place.ok) return place.result
      return tool(args, place.value)
    },
  }
}
