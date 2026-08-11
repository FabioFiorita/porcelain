import { DiffView } from '@/features/diff/diff-view'
import { changesDiffSource } from '@/features/diff/use-diff'
import { useReviewedPaths, useToggleReviewed } from './use-changes'

/**
 * The Changes tab's binding of the shared diff surface: the working tree or the branch range,
 * with the reviewed tick this tab owns.
 *
 * The tick lives here rather than in the surface because reviewing is a Changes idea — a
 * historical commit's diff renders the same rows with nothing to tick off.
 */
export function ChangesDiffView({
  active,
  base,
  filePath,
  onBack,
  onOpenFile,
  topInset = 0,
}: {
  active: boolean
  /** Branch scope base ref; `undefined` reads the working tree. */
  base: string | undefined
  filePath: string
  onBack?: () => void
  onOpenFile?: (path: string) => void
  topInset?: number
}): React.JSX.Element {
  const reviewedPaths = useReviewedPaths(active)
  const { mark, unmark } = useToggleReviewed()
  const isReviewed = reviewedPaths.has(filePath)

  return (
    <DiffView
      active={active}
      filePath={filePath}
      reviewed={{
        isReviewed,
        // mark/unmark are total void (React Query owns error + pending).
        onToggle: () => {
          if (isReviewed) unmark(filePath)
          else mark(filePath)
        },
      }}
      source={changesDiffSource(base)}
      testID="porcelain-changes-diff"
      topInset={topInset}
      onBack={onBack}
      onOpenFile={onOpenFile}
    />
  )
}
