import { useState } from 'react';
import { useAtomRefresh, useAtomValue } from '@effect/atom-react';
import { AsyncResult } from 'effect/reactivity';
import { readTextFile } from '@porcelain/client/files';
import {
  reviewStepLines,
  type ReviewStep,
} from '@porcelain/client/reviews/rules';
import type { Workspace } from '../../projects';
import { Box } from '../../../components/ui/box';
import { Text } from '../../../components/ui/text';
import { Button } from '../../../components/ui/button';
import { Empty } from '../../../components/ui/empty';
import { DiffView } from '../../../components/ui/diff-view';
import { sourceLanguage } from '../../../shared/rules/highlight-code';
import { ReviewReadState } from './read-state';
import { pointerSource } from '../rules/pointer-source';

export function ReviewPointer({
  workspace,
  step,
}: {
  workspace: Workspace;
  step: ReviewStep;
}) {
  const query = readTextFile({
    connection: workspace.connection,
    scope: workspace.scope,
    path: step.pointer.path,
  });
  const result = useAtomValue(query);
  const refresh = useAtomRefresh(query);
  const [whole, setWhole] = useState(false);
  if (!AsyncResult.isSuccess(result))
    return <ReviewReadState result={result} refresh={refresh} />;
  if ('kind' in result.value)
    return <Empty title="Code unavailable" description={result.value.reason} />;
  const range = reviewStepLines(step);
  const language = sourceLanguage(step.pointer.path);
  return (
    <Box gap={2}>
      <Text variant="caption" tone="muted">
        {step.pointer.path} · lines {range.startLine}–{range.endLine}
      </Text>
      {step.location.state === 'changed' ? (
        <Text variant="ui">
          Code changed since publication. This is the current file near the
          original range, not the original snippet.
        </Text>
      ) : null}
      <Button
        label={whole ? 'Show relevant range' : 'Show whole file'}
        variant="outline"
        onPress={() => setWhole(!whole)}
      />
      <Box className="h-96">
        <DiffView
          lines={pointerSource(step, result.value.text, whole)}
          {...(language ? { language } : {})}
          selection={step.location.state === 'changed' ? undefined : range}
        />
      </Box>
    </Box>
  );
}
