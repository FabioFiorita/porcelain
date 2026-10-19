export function reviewRouteSearch(search: Record<string, unknown>) {
  return {
    decision: typeof search.decision === 'string' ? search.decision : undefined,
    environment:
      typeof search.environment === 'string' ? search.environment : undefined,
  };
}
