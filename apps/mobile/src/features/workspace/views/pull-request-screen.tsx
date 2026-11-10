import { Stack, useLocalSearchParams } from 'expo-router';
import { Schema, Option } from 'effect';
import { ErrorState } from '../../../components/ui/error-state';
import { Screen } from '../../../components/ui/screen';
import { pullRequestTargetSchema } from '../../../shared/rules/pull-request-target';
import { PullRequestContent } from './pull-request-document';

export function PullRequestScreen() {
  const params = useLocalSearchParams();
  const target = Schema.decodeUnknownOption(pullRequestTargetSchema)({
    environmentId: params.environment,
    projectId: params.projectId,

    number: Number(params.number),
  });
  return (
    <Screen layout="fixed">
      <Stack.Screen
        options={{
          title: Option.isSome(target)
            ? `PR #${target.value.number}`
            : 'Pull request',
        }}
      />
      {Option.isSome(target) ? (
        <PullRequestContent target={target.value} />
      ) : (
        <ErrorState message="This pull request link is invalid. Return to Worktrees and open its PR again." />
      )}
    </Screen>
  );
}
