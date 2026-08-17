import type { TaskRow } from '@porcelain/client-runtime/tasks'
import { trpc } from '@renderer/lib/trpc'
import { useQueries } from '@tanstack/react-query'

function firstImage(row: TaskRow) {
  return row.task.attachments.find((attachment) => attachment.mime.startsWith('image/'))
}

/** First image attachment per row, so the table can show a real thumbnail. */
export function useTaskImagePreviews(
  rows: readonly TaskRow[],
): Readonly<Record<string, string | undefined>> {
  const utils = trpc.useUtils()
  const targets = rows.flatMap((row) => {
    const image = firstImage(row)
    return image === undefined ? [] : [{ taskId: row.task.id, attachmentId: image.id }]
  })
  const queries = useQueries({
    queries: targets.map((target) => ({
      queryKey: ['tasks', 'attachment', target.taskId, target.attachmentId],
      queryFn: async () =>
        utils.client.getTaskAttachment.query({
          taskId: target.taskId,
          attachmentId: target.attachmentId,
        }),
    })),
  })
  const previews: Record<string, string | undefined> = {}
  for (const [index, target] of targets.entries()) {
    previews[target.taskId] = queries[index]?.data?.dataUrl
  }
  return previews
}
