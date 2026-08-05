import { Text } from 'react-native'

import type { FileStatus } from '@/lib/daemon/procedures/changes'
import { cn } from '@/lib/utils'

/** The one-letter status lead, matching the web row — colour carries the meaning. */
const STATUS_BADGE: Record<FileStatus, { label: string; className: string }> = {
  added: { label: 'A', className: 'text-success' },
  deleted: { label: 'D', className: 'text-destructive' },
  modified: { label: 'M', className: 'text-warning' },
  renamed: { label: 'R', className: 'text-info' },
  untracked: { label: 'U', className: 'text-success' },
}

/**
 * A changed file's status lead. Shared so a file reads identically wherever it is listed —
 * the working tree, a branch range, or a historical commit.
 */
export function StatusBadge({
  className,
  status,
}: {
  className?: string
  status: FileStatus
}): React.JSX.Element {
  const badge = STATUS_BADGE[status]
  return (
    <Text className={cn('w-3 text-center font-mono text-xs font-bold', badge.className, className)}>
      {badge.label}
    </Text>
  )
}
