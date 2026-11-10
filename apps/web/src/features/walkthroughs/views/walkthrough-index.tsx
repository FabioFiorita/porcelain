import { useState, type ComponentProps, type ReactNode } from 'react';
import { GitBranchIcon } from 'lucide-react';
import {
  groupFilesByStep,
  plainText,
  type StepFiles,
} from '@porcelain/client/walkthroughs/rules';
import {
  ALL_CHANGES,
  entryKey,
  ReviewIndex,
  SidebarDocumentRow,
  type BranchFileGrouping,
  type ChangeGrouping,
  type OpenDocument,
  type ReviewIndexProps,
  type UncommittedFileGrouping,
} from '@/features/workspace/index';
import { TruncatedText } from '@/shared/views/truncated-text';
import {
  useBranchRenames,
  useWalkthroughContent,
} from '../queries/walkthrough';

type BranchSlot = ComponentProps<BranchFileGrouping>;
type UncommittedSlot = ComponentProps<UncommittedFileGrouping>;

function StepList<File>({
  steps,
  activeEntry,
  onOpen,
  row,
}: {
  steps: readonly StepFiles<File>[];
  activeEntry: string | undefined;
  onOpen: OpenDocument;
  row: (file: File) => ReactNode;
}) {
  const [open, setOpen] = useState<number | null>(null);
  if (steps.length === 0) return null;
  return (
    <div className="mt-1 flex flex-col">
      <p className="px-2 pt-2 pb-1 text-2xs text-muted-foreground">By step</p>
      {steps.map(({ stop, step, files }) => {
        const document = { kind: 'walkthrough-step', step } as const;
        const active = activeEntry === entryKey(document);
        return (
          <div key={step} className="flex flex-col">
            <SidebarDocumentRow
              plain
              label={`Step ${step}`}
              active={active}
              onOpen={() => {
                setOpen(step);
                onOpen(document);
              }}
            >
              <span className="w-3.5 shrink-0 text-center font-mono text-2xs text-muted-foreground">
                {step}
              </span>
              <TruncatedText
                className="min-w-0 flex-1"
                text={plainText(stop.title)}
              />
              {stop.attention && (
                <span
                  role="img"
                  aria-label="Your call"
                  className="size-1.5 shrink-0 rounded-full bg-foreground"
                />
              )}
              <span className="ml-auto text-2xs text-muted-foreground tabular-nums">
                {files.length}
              </span>
            </SidebarDocumentRow>
            {(open === step || active) && (
              <div className="pl-3">{files.map(row)}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function NotInWalkthrough<File>({
  files,
  row,
}: {
  files: readonly File[];
  row: (file: File) => ReactNode;
}) {
  if (files.length === 0) return null;
  return (
    <div className="mt-1 flex flex-col">
      <p className="px-2 pt-2 pb-1 text-2xs text-muted-foreground">
        Not in the walkthrough yet
      </p>
      {files.map(row)}
    </div>
  );
}

function BranchSteps({
  scope,
  context,
  items,
  row,
  activeEntry,
  onOpen,
}: BranchSlot) {
  const ready = useWalkthroughContent(scope, context);
  if (!ready || ready.content.stops.length === 0) return <>{items.map(row)}</>;
  const grouped = groupFilesByStep(ready.content, items);
  return (
    <>
      <StepList
        steps={grouped.steps.filter((entry) => entry.files.length > 0)}
        activeEntry={activeEntry}
        onOpen={onOpen}
        row={row}
      />
      <NotInWalkthrough files={grouped.outside} row={row} />
    </>
  );
}

function UncommittedSteps({
  scope,
  context,
  base,
  paths,
  row,
  activeEntry,
  onOpen,
}: UncommittedSlot) {
  const ready = useWalkthroughContent(scope, context);
  const renames = useBranchRenames(scope, context, base);
  if (paths.length === 0)
    return (
      <p className="p-3 text-sm text-muted-foreground">
        {ready ? 'Nothing uncommitted.' : 'No changes'}
      </p>
    );
  const allChanges = (
    <SidebarDocumentRow
      plain
      label="All changes"
      active={activeEntry === entryKey(ALL_CHANGES)}
      onOpen={() => onOpen(ALL_CHANGES)}
    >
      <GitBranchIcon className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">All changes</span>
      <span className="ml-auto text-2xs text-muted-foreground tabular-nums">
        {paths.length}
      </span>
    </SidebarDocumentRow>
  );
  if (!ready || ready.content.stops.length === 0)
    return (
      <div className="flex flex-col">
        {allChanges}
        {paths.map(row)}
      </div>
    );
  const files = paths.map((path) => ({ path }));
  const grouped = groupFilesByStep(ready.content, files, renames);
  const steps = grouped.steps.filter((entry) => entry.files.length > 0);
  return (
    <div className="flex flex-col">
      {allChanges}
      {steps.length > 0 && (
        <StepList
          steps={steps}
          activeEntry={activeEntry}
          onOpen={onOpen}
          row={(file) => row(file.path)}
        />
      )}
      <NotInWalkthrough
        files={grouped.outside}
        row={(file) => row(file.path)}
      />
    </div>
  );
}

const STEP_GROUPING: ChangeGrouping = {
  branch: BranchSteps,
  uncommitted: UncommittedSteps,
};

export function WalkthroughIndex(props: ReviewIndexProps) {
  return <ReviewIndex {...props} grouping={STEP_GROUPING} />;
}
