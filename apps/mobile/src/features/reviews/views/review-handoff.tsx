import type { ReviewRevision } from '@porcelain/client/reviews/rules';
import { Box } from '../../../components/ui/box';
import { Text } from '../../../components/ui/text';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { ErrorState } from '../../../components/ui/error-state';
import { usePreviewLink } from '../../../shared/adapters/preview-link';

export function ReviewHandoff({ revision }: { revision: ReviewRevision }) {
  const { tryIt, coverage } = revision.verdict;
  const link = usePreviewLink();
  if (!tryIt && !coverage?.length) return null;
  return (
    <Box gap={3}>
      {link.error ? <ErrorState message={link.error} /> : null}
      {tryIt ? (
        <Card padding={4} gap={2}>
          <Text variant="title">Try it</Text>
          <Button label="Open preview" onPress={() => link.open(tryIt.url)} />
          {tryIt.accounts.map((account, index) => (
            <Box key={index} gap={1}>
              <Text>{account.label}</Text>
              <Text variant="secondary" tone="muted">
                {account.signIn}
              </Text>
            </Box>
          ))}
          {tryIt.steps.map((step, index) => (
            <Text key={index} variant="secondary">
              {index + 1}. {step}
            </Text>
          ))}
        </Card>
      ) : null}
      {coverage && coverage.length > 0 ? (
        <Card padding={4} gap={3}>
          <Text variant="title">Asked, built, left</Text>
          {coverage.map((row, index) => (
            <Box key={index} gap={1}>
              <Text>Asked: {row.asked}</Text>
              <Text variant="secondary">Built: {row.built}</Text>
              <Text variant="secondary" tone="muted">
                Left: {row.left ? row.left.what : 'Complete'}
              </Text>
              {row.left ? (
                <Text variant="caption">
                  {row.left.owner
                    ? `Owner: ${row.left.owner.name}`
                    : 'Not done yet'}
                </Text>
              ) : null}
              {row.left &&
              row.left.owner?.kind === 'teammate' &&
              row.left.owner.message ? (
                <Text variant="secondary">
                  Draft message: {row.left.owner.message}
                </Text>
              ) : null}
            </Box>
          ))}
        </Card>
      ) : null}
    </Box>
  );
}
