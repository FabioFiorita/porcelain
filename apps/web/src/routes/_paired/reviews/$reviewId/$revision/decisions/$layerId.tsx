import { reviewRouteSearch } from '@/features/reviews/index';
import { createFileRoute } from '@tanstack/react-router';
import { ReviewRoute } from '@/app/review-route';
export const Route = createFileRoute(
  '/_paired/reviews/$reviewId/$revision/decisions/$layerId',
)({
  validateSearch: reviewRouteSearch,
  component: Page,
});
function Page() {
  const { layerId, ...params } = Route.useParams();
  return <ReviewRoute {...params} {...Route.useSearch()} decision={layerId} />;
}
