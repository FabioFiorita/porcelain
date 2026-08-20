import { ReviewCommentsScreen } from '@/features/comments'

/**
 * The review conversation for the selected checkout.
 *
 * A static sibling of `doc/[id]`, not of `[id]`, so a Canvas that happens to be named
 * "comments" cannot shadow it — the document route lives one segment deeper for that reason.
 */
export default function CanvasCommentsRoute(): React.JSX.Element {
  return <ReviewCommentsScreen />
}
