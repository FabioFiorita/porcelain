import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@renderer/components/ui/empty'
import { FileCheck2 } from 'lucide-react'

export function ChangesEmptyState(): React.JSX.Element {
  return (
    <Empty className="min-h-36 border-none bg-muted/20 px-4 py-8">
      <EmptyMedia>
        <FileCheck2 />
      </EmptyMedia>
      <EmptyHeader>
        <EmptyTitle>No changes to review</EmptyTitle>
        <EmptyDescription>Your working tree is clean.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
