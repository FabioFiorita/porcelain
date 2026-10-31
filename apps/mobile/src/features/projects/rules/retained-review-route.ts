export function retainedReviewRoute(group: string | undefined) {
  switch (group) {
    case '(files)':
      return '/(files)/retained-review/[reviewId]' as const;
    case '(history)':
      return '/(history)/retained-review/[reviewId]' as const;
    default:
      return '/(review)/reviews/[reviewId]' as const;
  }
}

export function pullRequestRoute(group: string | undefined) {
  switch (group) {
    case '(history)':
      return '/(history)/pull-request' as const;
    case '(review)':
      return '/(review)/pull-request' as const;
    default:
      return '/(files)/pull-request' as const;
  }
}
