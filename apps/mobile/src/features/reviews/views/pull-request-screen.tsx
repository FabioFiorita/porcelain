import { Stack, useLocalSearchParams } from 'expo-router';
import { Schema, Option } from 'effect';
import { pullRequestDocumentSchema } from '../../../shared/rules/workspace-documents';
import { Box } from '../../../components/ui/box';
import { ErrorState } from '../../../components/ui/error-state';
import { PullRequestDocumentContent } from './pull-request-document';

export function PullRequestScreen() {
  const params = useLocalSearchParams();
  const document = Schema.decodeUnknownOption(pullRequestDocumentSchema)({
    kind: 'pull-request',
    environmentId: params.environment,
    projectId: params.projectId,
    reviewId: params.reviewId,
    number: Number(params.number),
  });
  return (
    <Box className="flex-1" surface="background">
      <Stack.Screen
        options={{
          title: Option.isSome(document)
            ? `PR #${document.value.number}`
            : 'Pull request',
        }}
      />
      {Option.isSome(document) ? (
        <PullRequestDocumentContent document={document.value} />
      ) : (
        <ErrorState message="This pull request link is invalid. Return to Worktrees and open its PR again." />
      )}
    </Box>
  );
}
