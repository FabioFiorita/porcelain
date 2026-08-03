import { useTabRootFocusRegistration } from '@/components/use-tab-root-focus'
import { BoardScreen } from '@/features/board/board-screen'
import { ReviewScreen } from '@/features/review/review-screen'
import { useTabFaces } from '@/lib/tab-faces'

/** One tab slot, two faces — re-tap the tab bar to flip; no stack push / back chevron. */
export default function ReviewTabRoot(): React.JSX.Element {
  useTabRootFocusRegistration('review')
  const face = useTabFaces((state) => state.review)
  return face === 'board' ? <BoardScreen /> : <ReviewScreen />
}
