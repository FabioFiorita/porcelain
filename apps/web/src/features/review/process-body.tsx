import type { ReviewReading } from '@porcelain/contracts/review'
import { ReadingSurfaceBody } from './reading-surface'
import { readingForProcess } from './review-reading-projections'

/** Process: the agent-authored walkthrough while Execution owns the file inventory. */
export function ProcessBody({ reading }: { reading: ReviewReading }): React.JSX.Element {
  const processReading = readingForProcess(reading)

  if (reading.sections.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="max-w-sm text-center text-sm text-muted-foreground">
          No Process yet — publish walkthrough sections with{' '}
          <span className="font-mono text-2xs">review set --sections</span>.
        </p>
      </div>
    )
  }

  return (
    <ReadingSurfaceBody
      reading={processReading}
      trackFocus
      includeEvidence={false}
      includeAnchors={false}
    />
  )
}
