import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { plainText, stopPaths } from '@porcelain/client/walkthroughs/rules';
import { Button } from '@/components/ui/button';
import {
  BranchDocument,
  PlainChangesDocument,
  type DocumentHeading,
  type StepDocumentProps,
} from '@/features/workspace/index';
import { StateNotice } from '@/shared/views/state-notice';
import {
  useBranchRenames,
  useWalkthroughContent,
} from '../queries/walkthrough';
import { RichText } from './rich-text';
import { StepButton } from './step-button';

export function WalkthroughStepDocument({
  step,
  changeScope,
  ...props
}: StepDocumentProps) {
  const ready = useWalkthroughContent(props.scope, props.context);
  const renames = useBranchRenames(props.scope, props.context, props.base);
  const stop = ready?.content.stops[step - 1];
  if (!ready || !stop)
    return (
      <StateNotice
        title="This step isn't available"
        description="The walkthrough changed since this tab was opened. Open the Walkthrough tab for the current steps."
      >
        <Button
          variant="outline"
          onClick={() => props.onOpen({ kind: 'handoff' })}
        >
          Open walkthrough
        </Button>
      </StateNotice>
    );
  const total = ready.content.stops.length;
  const label = `Step ${step} of ${total}`;
  const heading: DocumentHeading = {
    title: (
      <>
        <span className="mr-2 font-normal text-muted-foreground">{label}</span>
        <RichText text={stop.title} />
      </>
    ),
    titleLabel: `${label}: ${plainText(stop.title)}`,
    after: (
      <span className="flex items-center">
        <StepButton
          label="Previous step"
          icon={<ChevronLeftIcon />}
          disabled={step === 1}
          onClick={() =>
            props.onOpen({ kind: 'walkthrough-step', step: step - 1 })
          }
        />
        <StepButton
          label="Next step"
          icon={<ChevronRightIcon />}
          disabled={step === total}
          onClick={() =>
            props.onOpen({ kind: 'walkthrough-step', step: step + 1 })
          }
        />
      </span>
    ),
  };
  const only = stopPaths(stop, renames);
  return changeScope === 'uncommitted' ? (
    <PlainChangesDocument {...props} only={only} heading={heading} />
  ) : (
    <BranchDocument {...props} only={only} heading={heading} />
  );
}
