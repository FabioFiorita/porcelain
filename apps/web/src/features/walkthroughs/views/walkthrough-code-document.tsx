import { useState } from 'react';
import { useChanges } from '@/features/changes/index';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { plainText, stopPaths } from '@porcelain/client/walkthroughs/rules';
import { Button } from '@/components/ui/button';
import {
  BranchDocument,
  PlainChangesDocument,
  type DocumentHeading,
  type WalkthroughCodeProps,
  type DocumentProps,
  BranchState,
  DocumentToolbar,
} from '@/features/workspace/index';
import { StateNotice } from '@/shared/views/state-notice';
import {
  useBranchRenames,
  useWalkthroughContent,
} from '../queries/walkthrough';
import { RichText } from './rich-text';
import { StepButton } from './step-button';

export function WalkthroughCodeDocument({
  document,
  ...props
}: WalkthroughCodeProps) {
  const ready = useWalkthroughContent(props.scope, props.context);
  const renames = useBranchRenames(props.scope, props.context, props.base);
  const step = document.kind === 'walkthrough-step' ? document.step : undefined;
  const stop = step === undefined ? undefined : ready?.content.stops[step - 1];
  if (!ready || (document.kind === 'walkthrough-step' && !stop))
    return (
      <StateNotice
        title="This step isn't available"
        description="The walkthrough changed since this tab was opened. Open the Walkthrough tab for the current steps."
      >
        <Button
          variant="outline"
          onClick={() => props.onOpen({ kind: 'walkthrough' })}
        >
          Open walkthrough
        </Button>
      </StateNotice>
    );
  if (step === undefined || stop === undefined)
    return (
      <WalkthroughChangeDocument
        {...props}
        heading={{ title: 'All changes', titleLabel: 'All changes' }}
      />
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
  return <WalkthroughChangeDocument {...props} only={only} heading={heading} />;
}

function WalkthroughChangeDocument(
  props: DocumentProps & { only?: readonly string[]; heading: DocumentHeading },
) {
  const changes = useChanges(props.scope, props.context.connection);
  const [focused, setFocused] = useState<'branch' | 'uncommitted'>('branch');
  return (
    <BranchState scope={props.scope} context={props.context} base={props.base}>
      {(branch) => {
        const includes = (file: {
          path: string;
          oldPath?: string | undefined;
        }) =>
          props.only === undefined ||
          props.only.includes(file.path) ||
          (file.oldPath !== undefined && props.only.includes(file.oldPath));
        const committed = [
          ...new Set(branch.files.filter(includes).map((file) => file.path)),
        ];
        const dirty = [
          ...new Set(changes.changes.filter(includes).map((file) => file.path)),
        ];
        const both = committed.length > 0 && dirty.length > 0;
        const interaction = (scope: 'branch' | 'uncommitted') => ({
          ...props.interaction,
          active: props.interaction.active && (!both || focused === scope),
          toolbarTarget:
            both && focused !== scope ? null : props.interaction.toolbarTarget,
          entry: both
            ? `${props.interaction.entry}:${scope}`
            : props.interaction.entry,
        });
        return (
          <div className="flex min-h-0 flex-1 flex-col">
            {both && (
              <DocumentToolbar
                inline
                title={props.heading.title}
                titleLabel={props.heading.titleLabel}
              >
                {props.heading.after}
              </DocumentToolbar>
            )}
            <div
              className={
                both
                  ? 'min-h-0 flex-1 overflow-auto'
                  : 'flex min-h-0 flex-1 flex-col'
              }
            >
              {committed.length > 0 && (
                <section
                  aria-label="Branch code"
                  className="flex min-h-0 flex-1 flex-col"
                  onFocusCapture={() => setFocused('branch')}
                  onPointerDownCapture={() => setFocused('branch')}
                >
                  <BranchDocument
                    {...props}
                    only={committed}
                    fullHeight={both}
                    interaction={interaction('branch')}
                    heading={
                      both
                        ? { title: 'Branch', titleLabel: 'Branch' }
                        : props.heading
                    }
                  />
                </section>
              )}
              {dirty.length > 0 && (
                <section
                  aria-label="Uncommitted code"
                  className="flex min-h-0 flex-1 flex-col"
                  onFocusCapture={() => setFocused('uncommitted')}
                  onPointerDownCapture={() => setFocused('uncommitted')}
                >
                  <PlainChangesDocument
                    {...props}
                    only={dirty}
                    fullHeight={both}
                    interaction={interaction('uncommitted')}
                    heading={
                      both
                        ? { title: 'Uncommitted', titleLabel: 'Uncommitted' }
                        : props.heading
                    }
                  />
                </section>
              )}
              {committed.length === 0 && dirty.length === 0 && (
                <StateNotice
                  title="No changed files"
                  description="These files no longer have changes in the branch or working tree."
                />
              )}
            </div>
          </div>
        );
      }}
    </BranchState>
  );
}
