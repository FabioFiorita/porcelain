import { useRouter } from 'expo-router';
import type { PullRequestTarget } from '../../../shared/rules/pull-request-target';

export function useOpenPullRequest() {
  const router = useRouter();
  return (target: PullRequestTarget) =>
    router.push({
      pathname: '/pull-request',
      params: {
        environment: target.environmentId,
        projectId: target.projectId,

        number: String(target.number),
      },
    });
}
