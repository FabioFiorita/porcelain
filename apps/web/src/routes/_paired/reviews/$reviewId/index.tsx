import { reviewRouteSearch } from '@/features/reviews/index';
import { createFileRoute } from '@tanstack/react-router';
import { ReviewRoute } from '@/app/review-route';
export const Route = createFileRoute('/_paired/reviews/$reviewId/')({
  validateSearch: reviewRouteSearch,
  component: Page,
});
function Page() {
  return <ReviewRoute {...Route.useParams()} {...Route.useSearch()} />;
}
