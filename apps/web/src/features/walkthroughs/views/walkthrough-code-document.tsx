import { branchReviewRange } from '@porcelain/client/changes/rules';
import { useState } from 'react';
import { useChanges } from '@/features/changes/index';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import {
  plainText,
  stopPaths,
  walkthroughCodeScopes,
  type ReviewCode as ReviewCodeFiles,
} from '@porcelain/client/walkthroughs/rules';
import { Button } from '@/components/ui/button';
import {
  BranchDocument,
  StepReviewed,
  PlainChangesDocument,
  type DocumentHeading,
  type WalkthroughCodeProps,
  type DocumentProps,
  BranchState,
  DocumentToolbar,
  type ComparedBranch,
} from '@/features/workspace/index';
import { StateNotice } from '@/shared/views/state-notice';
import { DIFF_WINDOW_FILES } from '@/config/limits';
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
  const step = document.step;
  const stop = ready?.content.stops[step - 1];
  if (!ready || !stop)
    return (
      <StateNotice
        message="The walkthrough changed since this tab was opened."
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => props.onOpen({ kind: 'review' })}
          >
            Open review
          </Button>
        }
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

export function ReviewCode({
  document,
  entry,
  code,
  label,
  branch,
  eager,
}: {
  document: DocumentProps;
  entry: string;
  code: ReviewCodeFiles;
  label: string;
  branch: ComparedBranch | undefined;
  eager: boolean;
}) {
  const [shown, setShown] = useState(DIFF_WINDOW_FILES);
  const [near, setNear] = useState(eager);
  if (eager && !near) setNear(true);
  const committed = branch ? code.branch : [];
  if (committed.length === 0 && code.worktree.length === 0) return null;
  if (!near)
    return (
      <div
        role="group"
        aria-label={`Code: ${label}`}
        ref={whenNear(() => setNear(true))}
        className="-mx-5 flex flex-col gap-2 @3xl:-mx-8"
      >
        <FileNames title="Branch" paths={committed} />
        <FileNames title="Uncommitted" paths={code.worktree.slice(0, shown)} />
      </div>
    );
  const interaction = (scope: 'branch' | 'uncommitted') => ({
    ...document.interaction,
    active: false,
    quiet: true,
    toolbarTarget: null,
    fileTarget: undefined,
    entry: `${entry}:${scope}`,
  });
  return (
    <div
      role="group"
      aria-label={`Code: ${label}`}
      className="-mx-5 flex flex-col gap-2 @3xl:-mx-8"
    >
      {committed.length > 0 && (
        <section aria-label={`${label}: branch`} className="flex flex-col">
          <BranchDocument
            {...document}
            compared={branch}
            only={committed}
            fullHeight
            interaction={interaction('branch')}
            heading={{ title: 'Branch', titleLabel: `${label}: branch` }}
          />
        </section>
      )}
      {code.worktree.length > 0 && (
        <section aria-label={`${label}: uncommitted`} className="flex flex-col">
          <PlainChangesDocument
            {...document}
            only={code.worktree}
            limit={shown}
            onReadMore={() => setShown(shown + DIFF_WINDOW_FILES)}
            fullHeight
            interaction={interaction('uncommitted')}
            heading={{
              title: 'Uncommitted',
              titleLabel: `${label}: uncommitted`,
            }}
          />
        </section>
      )}
    </div>
  );
}

function whenNear(onNear: () => void) {
  return (element: HTMLElement | null) => {
    if (!element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onNear();
      },
      {
        root: element.closest<HTMLElement>('[data-review-scroll]'),
        rootMargin: '600px 0px',
      },
    );
    observer.observe(element);
    return () => observer.disconnect();
  };
}

function FileNames({
  title,
  paths,
}: {
  title: string;
  paths: readonly string[];
}) {
  if (paths.length === 0) return null;
  return (
    <section className="flex flex-col">
      <h3 className="border-b px-4 py-2.5 text-ui font-semibold">{title}</h3>
      <ul>
        {paths.slice(0, DIFF_WINDOW_FILES).map((path) => (
          <li
            key={path}
            className="min-h-40 px-4 py-3 font-mono text-caption text-muted-foreground"
          >
            {path}
          </li>
        ))}
      </ul>
    </section>
  );
}

function WalkthroughChangeDocument(
  props: DocumentProps & { only: readonly string[]; heading: DocumentHeading },
) {
  const changes = useChanges(props.scope, props.context.connection);
  const [focused, setFocused] = useState<'branch' | 'uncommitted'>('branch');
  return (
    <BranchState scope={props.scope} context={props.context} base={props.base}>
      {(branch) => {
        const { branch: committed, worktree: dirty } = walkthroughCodeScopes({
          branch: branch.files,
          worktree: changes.changes,
          only: props.only,
        });
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
            <StepReviewed
              scope={props.scope}
              context={props.context}
              interaction={props.interaction}
              branchFiles={branch.files}
              changes={changes}
              committed={committed}
              dirty={dirty}
              range={branchReviewRange(branch)}
            />
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
                <StateNotice message="These files no longer have changes." />
              )}
            </div>
          </div>
        );
      }}
    </BranchState>
  );
}
