import { createFileRoute } from '@tanstack/react-router';
import { ProjectHistoryRoute } from '@/app/project-history-route';
export const Route = createFileRoute('/_paired/reviews/history/$projectId')({
  validateSearch: (
    search: Record<string, unknown>,
  ): { environment?: string } =>
    typeof search.environment === 'string'
      ? { environment: search.environment }
      : {},
  component: Page,
});
function Page() {
  return <ProjectHistoryRoute {...Route.useParams()} {...Route.useSearch()} />;
}
