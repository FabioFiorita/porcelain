import type { Task, TaskAttachment } from '@porcelain/contracts/tasks'
import { useQueries } from '@tanstack/react-query'
import { Image, View } from 'react-native'

import { PANEL_CARD } from '@/components/surface-layout'
import { Text } from '@/components/ui/text'
import { getEnvironment } from '@/features/remote'
import { cn } from '@/lib/utils'

import { getTaskAttachmentProcedure } from './tasks-procedures'
import { taskAttachmentKey } from './tasks-query-key'
import { callTasksProcedure } from './use-tasks-transport'

/**
 * The files the daemon copied onto a Task when it was created.
 *
 * Only pictures are fetched. `taskAttachmentSchema` carries a name, a byte size and a MIME
 * type, which is enough to LIST anything; the bytes come back as a base64 data URL over tRPC,
 * so pulling a log or an archive across the wire to render a filename would be a download
 * nobody asked for. `storedPath` is deliberately never shown — it is the daemon's own layout.
 *
 * Adding an attachment from the phone is not built: `createTask` takes either absolute host
 * paths (a phone has no host filesystem the daemon can read) or base64 uploads, and nothing in
 * this app picks an image today.
 */

function isPicture(attachment: TaskAttachment): boolean {
  return attachment.mime.startsWith('image/')
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function TaskAttachments({
  environmentId,
  task,
}: {
  environmentId: string
  task: Task
}): React.JSX.Element | null {
  const pictures = task.attachments.filter(isPicture)
  const loaded = useQueries({
    queries: pictures.map((attachment) => ({
      queryFn: async (): Promise<string> => {
        const result = await callTasksProcedure(
          getEnvironment(environmentId),
          getTaskAttachmentProcedure,
          { attachmentId: attachment.id, taskId: task.id },
        )
        return result.dataUrl
      },
      queryKey: taskAttachmentKey(environmentId, task.id, attachment.id),
      // The bytes behind an attachment id never change, so a refetch can only cost data.
      staleTime: Number.POSITIVE_INFINITY,
    })),
  })

  if (task.attachments.length === 0) return null

  return (
    <View className="gap-2" testID="porcelain-task-attachments">
      {pictures.length === 0 ? null : (
        <View className="flex-row flex-wrap gap-2">
          {pictures.map((attachment, index) => {
            const uri = loaded[index]?.data
            return uri === undefined ? null : (
              <Image
                accessibilityLabel={attachment.name}
                className="size-24 rounded-xl"
                key={attachment.id}
                source={{ uri }}
                testID={`porcelain-task-picture-${attachment.id}`}
              />
            )
          })}
        </View>
      )}
      <View className={cn(PANEL_CARD, 'gap-1 p-2.5')}>
        {task.attachments.map((attachment) => (
          <View className="flex-row items-center gap-2" key={attachment.id}>
            <Text className="min-w-0 flex-1 text-xs text-foreground" numberOfLines={1}>
              {attachment.name}
            </Text>
            <Text className="shrink-0 font-mono text-3xs text-muted-foreground">
              {formatBytes(attachment.byteSize)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  )
}
