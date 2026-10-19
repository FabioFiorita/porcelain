import { Card } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { ProofChecks } from './proof-checks';
import {
  verdictSections,
  type ReviewRevision,
} from '@porcelain/client/reviews/rules';
import { externalLink } from '@porcelain/client/links/rules';
import { usePreviewLink } from '../../../shared/adapters/preview-link';
import { Box } from '../../../components/ui/box';
import { Text } from '../../../components/ui/text';
import { Button } from '../../../components/ui/button';
import { ErrorState } from '../../../components/ui/error-state';

export function LinkedVerdict({ revision }: { revision: ReviewRevision }) {
  const sections = verdictSections(revision);
  const link = usePreviewLink();
  return (
    <Box gap={4}>
      {link.error ? <ErrorState message={link.error} /> : null}
      <Box gap={2}>
        <Text variant="heading">Asked</Text>
        <Text selectable>{sections.asked.text}</Text>
        {sections.asked.links.map((entry, index) =>
          externalLink(entry.url) ? (
            <Button
              key={`${index}:${entry.url}`}
              label={entry.title}
              accessibilityLabel={`Open brief: ${entry.title}`}
              variant="outline"
              onPress={() => link.open(entry.url)}
            />
          ) : (
            <Text key={index}>{entry.title}</Text>
          ),
        )}
      </Box>
      <Card
        variant={
          sections.recommendation.value === 'hold' ? 'warning' : 'success'
        }
        padding={4}
        gap={2}
      >
        <Badge label="Recommendation" variant="outline" />
        <Text variant="heading">{sections.recommendation.label}</Text>
        {sections.recommendation.reasons.map((reason, index) => (
          <Text key={index} selectable>
            {reason}
          </Text>
        ))}
      </Card>
      <Box gap={2}>
        <Text variant="heading">Proven at {sections.proven.shortHead}</Text>
        {sections.proven.checks.length === 0 &&
        sections.proven.assets.length === 0 ? (
          <Text variant="ui" tone="muted">
            No proof was published.
          </Text>
        ) : null}
        <ProofChecks checks={sections.proven.checks} />
        {sections.proven.assets.map((asset) =>
          asset.kind === 'link' && externalLink(asset.url) ? (
            <Button
              key={asset.id}
              label={asset.title}
              accessibilityLabel={`Open proof: ${asset.title}`}
              variant="outline"
              onPress={() => link.open(asset.url)}
            />
          ) : (
            <Text key={asset.id} variant="ui">
              {asset.title} · {asset.kind}
            </Text>
          ),
        )}
      </Box>
      <Box gap={2}>
        <Text variant="heading">Not proven</Text>
        {sections.notProven.length === 0 ? (
          <Text variant="ui" tone="muted">
            No proof gaps were reported.
          </Text>
        ) : null}
        {sections.notProven.map((entry, index) => (
          <Box key={index} gap={1}>
            <Text variant="ui" weight="medium">
              {entry.what}
            </Text>
            <Text selectable>{entry.why}</Text>
          </Box>
        ))}
      </Box>
      <Card variant="destructive" padding={4} gap={3}>
        <Text variant="heading" tone="destructive">
          Removed
        </Text>
        {sections.removed.fileCount === 0 ? (
          <Text variant="ui">No files were deleted.</Text>
        ) : null}
        {sections.removed.groups.map((entry, index) => (
          <Box key={index} gap={1}>
            <Text variant="ui" weight="medium">
              {entry.behavior}
            </Text>
            <Text selectable>{entry.why}</Text>
            {entry.paths.map((path) => (
              <Text key={path} variant="code" selectable>
                {path}
              </Text>
            ))}
          </Box>
        ))}
        {sections.removed.unexplainedPaths.map((path) => (
          <Text key={path} variant="code" tone="destructive" selectable>
            {path} · No removal explanation was published.
          </Text>
        ))}
      </Card>
    </Box>
  );
}
