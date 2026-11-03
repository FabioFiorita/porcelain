import { useAtomValue } from '@effect/atom-react';
import { Empty } from '../components/ui/empty';
import { ListDetail } from '../components/ui/list-detail';
import { ReviewInbox, reviewPaneOpen } from '../features/projects';
import { ReviewPane } from '../features/reviews';

export function ReviewsHome() {
  const open = useAtomValue(reviewPaneOpen);
  return (
    <ListDetail
      list={(mode) => <ReviewInbox mode={mode} />}
      detail={
        open ? (
          <ReviewPane />
        ) : (
          <Empty
            title="Select a review"
            description="Choose a review on the left to read it here."
          />
        )
      }
    />
  );
}
