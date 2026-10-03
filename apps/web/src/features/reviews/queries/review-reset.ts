import { useQueryErrorResetBoundary } from '@tanstack/react-query';

export function useReviewReset() {
  return useQueryErrorResetBoundary();
}
