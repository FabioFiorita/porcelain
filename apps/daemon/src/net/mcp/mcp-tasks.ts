import type { McpTask } from './mcp-operations'

/**
 * How a Task reads to an agent.
 *
 * The row on the wire is not the view. Two differences carry the whole point: the
 * agent gets back the SHORT id it will type next (`T-18` is what the human says and
 * what the app shows), and every attachment arrives as a path it can actually open.
 * A Task that says "there is a screenshot" without a readable path is the exact
 * moment an agent gives up on the tool and starts reading `$PORCELAIN_HOME` itself.
 */
export function taskView(
  task: McpTask,
  attachmentPath: (storedPath: string) => string,
): Record<string, unknown> {
  return {
    id: task.shortId ?? task.id,
    uuid: task.id,
    title: task.title,
    status: task.status,
    ...(task.notes === undefined ? {} : { notes: task.notes }),
    ...(task.tags === undefined || task.tags.length === 0 ? {} : { tags: task.tags }),
    ...(task.links === undefined || task.links.length === 0 ? {} : { links: task.links }),
    ...(task.pathRefs === undefined || task.pathRefs.length === 0
      ? {}
      : { pathRefs: task.pathRefs }),
    ...(task.references === undefined ? {} : { references: task.references }),
    ...(task.attachments === undefined || task.attachments.length === 0
      ? {}
      : {
          attachments: task.attachments.map((attachment) => ({
            id: attachment.id,
            name: attachment.name,
            mime: attachment.mime,
            // Absolute on the DAEMON host: read it directly when that host is this
            // machine, and treat it as a name only when the daemon is remote.
            hostPath: attachmentPath(attachment.storedPath),
          })),
        }),
    ...(task.updatedAt === undefined ? {} : { updatedAt: task.updatedAt }),
  }
}

/** Match by short id (`T-18`, case-insensitive) or UUID — both are ids an agent has seen. */
export function taskMatches(task: McpTask, wanted: string): boolean {
  const needle = wanted.trim().toLowerCase()
  return task.id.toLowerCase() === needle || (task.shortId ?? '').toLowerCase() === needle
}

/** A refusal that names the ids that would have worked, rather than only the one that did not. */
export function describeMissingTask(wanted: string, tasks: readonly McpTask[]): string {
  const known = tasks
    .map((task) => task.shortId ?? task.id)
    .slice(0, 40)
    .join(', ')
  return `No Task ${wanted} on this daemon. Known Tasks: ${known === '' ? '(none)' : known}. List them with porcelain_context include: ["tasks"].`
}

/**
 * Adding one link must not drop the others. `porcelain_task` takes a single `link`
 * because attaching a PR is the common move, but `updateTask` replaces the whole
 * array — so the merge happens here rather than costing the caller a read.
 */
export function mergeLink(
  existing: readonly { url: string; label?: string }[] | undefined,
  link: { url: string; label: string },
): { url: string; label: string }[] {
  const kept = (existing ?? [])
    .filter((entry) => entry.url !== link.url)
    .map((entry) => ({ url: entry.url, label: entry.label ?? entry.url }))
  return [...kept, link]
}
