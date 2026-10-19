import type { ReviewResponse } from '@porcelain/client/reviews/rules';
import { Box } from '../../../components/ui/box';
import { Text } from '../../../components/ui/text';

export function ProofChecks({
  checks,
}: {
  checks: ReviewResponse['proof']['checks'];
}) {
  return checks.map((check, index) => (
    <Box key={`${index}:${check.name}`} gap={1}>
      <Text variant="ui" weight="medium">
        {check.name} · {check.result}
      </Text>
      {check.output ? (
        <Text variant="caption" selectable>
          {check.output}
        </Text>
      ) : null}
    </Box>
  ));
}
