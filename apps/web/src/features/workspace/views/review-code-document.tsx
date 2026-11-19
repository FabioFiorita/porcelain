import { useHotkeysEnabled } from '@/shared/hooks/use-hotkeys-enabled';
import { cn } from '@/shared/lib/utils';
import { TruncatedText } from '@/shared/views/truncated-text';
import { diffSelection, omissionReason } from '@porcelain/client/changes/rules';
import { type ReactNode, useState } from 'react';
import { useHotkey } from '@tanstack/react-hotkeys';
import { CheckIcon, SquareIcon } from 'lucide-react';
import { BarAction } from '@/shared/workspace/bar-action';
import { SHORTCUTS } from '@/shared/workspace/shortcuts';
import { toast } from '@/components/ui/toast';
import { useToggleReviewed } from '../commands/reviewed';
import { Badge } from '@/components/ui/badge';
import { isImagePath } from '@porcelain/client/files/rules';
import { Button } from '@/components/ui/button';
import { changeId, selectionKey } from '@porcelain/client/changes/rules';
import {
  diffEntry,
  useChangeDiffs,
  useChanges,
} from '@/features/changes/index';
import { ImagePreview, useTextContents } from '@/features/files/index';
import { useHeldWhileHidden } from '@/shared/hooks/use-held-while-hidden';
import { type CodeEntry, fileEntry } from '../adapters/code-entries';

import { omittedReasonText } from '../rules/omitted-reasons';
import { usePrefetchReviewed, useReviewChangeItems } from '../queries/reviewed';
import type { DocumentInteraction } from '../rules/documents';
import { focusPatch, type LineSpan } from '@porcelain/client/changes/rules';
import {
  type Change,
  type DiffContent,
  orderReviewChanges,
  type ReviewChangeItem,
  type ReviewScope,
} from '@porcelain/client/changes/rules';
import { CodeDocument, type CodeHeaderControls } from './code-document';
import { ReservedCode } from './reserved-code';
import { fileReviewControl, ReviewedControl } from './reviewed-control';
import { type ConnectionContext } from '@/shared/workspace/connection';

export function ReviewCodeDocument({
  scope,
  context,
  interaction,
  paths,
  files = [],
  focus,
  header,
  headerActions,
  headerLeading,
  toolbar,
  footer,
  column = false,
  fullHeight = false,
}: {
  footer?: () => ReactNode;
  scope: ReviewScope;
  context: ConnectionContext;
  interaction: DocumentInteraction;
  paths?: readonly string[];
  files?: readonly { path: string; note?: string }[];
  focus?: Readonly<Record<string, readonly LineSpan[]>>;
  header?: (controls: CodeHeaderControls) => ReactNode;
  column?: boolean;
  fullHeight?: boolean | undefined;
  headerActions?: ReactNode;
  headerLeading?: ReactNode;
  toolbar?: (collapseControl: ReactNode) => ReactNode;
}) {
  const { connection } = context;
  const [pendingOmittedPath, setPendingOmittedPath] = useState<string>();
  const focusOmitted = (path: string, target: HTMLLIElement) => {
    if (pendingOmittedPath !== path) return;
    setPendingOmittedPath(undefined);
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: 'start' });
  };
  usePrefetchReviewed(scope, context);
  const quiet = interaction.quiet === true;
  const changes = useHeldWhileHidden(
    useChanges(scope, connection),
    interaction.hidden === true,
  );
  const items = orderReviewChanges(
    useReviewChangeItems(scope, context, changes, paths),
    files,
  );
  const statusToken = items[0]?.statusToken ?? '';
  const diffs = useChangeDiffs(
    scope,
    connection,
    statusToken,
    items.flatMap((item) =>
      item.comparisons.some(
        (change) => change.scope === 'staged' || change.scope === 'unstaged',
      )
        ? [{ path: item.path, fingerprint: item.fingerprint }]
        : [],
    ),
    items.flatMap((item) =>
      item.comparisons.flatMap((change) => {
        const selection = diffSelection(change);
        return selection ? [selection] : [];
      }),
    ),
  );
  const untracked = useTextContents(
    connection,
    scope,
    interaction.hidden === true
      ? []
      : items.flatMap((item) =>
          item.comparisons.flatMap((change) =>
            change.scope === 'untracked' ? [change.path] : [],
          ),
        ),
  );
  const [keptText, setKeptText] = useState(untracked.contents);
  if (
    interaction.hidden !== true &&
    !untracked.pending &&
    !untracked.failed &&
    !sameTexts(keptText, untracked.contents)
  )
    setKeptText(untracked.contents);
  const textOf = (path: string) =>
    untracked.contents.get(path) ??
    (quiet || untracked.failed ? keptText.get(path) : undefined);
  const [kept, setKept] = useState(diffs.diffs);
  if (!diffs.pending && !diffs.failed && kept !== diffs.diffs)
    setKept(diffs.diffs);
  const livePatch = (change: Change): DiffContent | undefined => {
    const selection = diffSelection(change);
    return selection ? diffs.diffs.get(selectionKey(selection)) : undefined;
  };
  const patchOf = (change: Change): DiffContent | undefined => {
    const selection = diffSelection(change);
    if (!selection) return undefined;
    return (
      livePatch(change) ??
      (quiet || diffs.failed ? kept.get(selectionKey(selection)) : undefined)
    );
  };
  const loading = !quiet && (diffs.pending || untracked.pending);
  const failed =
    (diffs.failed || untracked.failed) &&
    !diffs.pending &&
    !untracked.pending &&
    kept.size === 0 &&
    keptText.size === 0;
  const notes = new Map(files.map((file) => [file.path, file.note]));
  const unrenderable = items.flatMap((item) => {
    const reasons = item.comparisons.flatMap((change) => {
      if (change.scope === 'unmerged') return ['Conflict'];
      if (change.scope === 'untracked')
        return textOf(change.path) !== undefined || untracked.pending
          ? []
          : ['Not readable'];
      if (!change.supported) return ['Unsupported comparison'];
      const content = patchOf(change);
      if (!content) return [];
      if (content.kind === 'binary') return ['Binary change'];
      if (content.kind === 'omitted')
        return [`Content omitted: ${omissionReason(content.reason)}`];
      return diffEntry(change, content) ? [] : ['No single-file textual patch'];
    });
    const current = item.comparisons.every((change) =>
      change.scope === 'untracked'
        ? textOf(change.path) === undefined ||
          untracked.contents.has(change.path)
        : patchOf(change) === undefined || livePatch(change) !== undefined,
    );
    return reasons.length > 0 ? [{ item, reasons, current }] : [];
  });
  const entries = items.flatMap((item): CodeEntry[] =>
    item.comparisons.flatMap((change): CodeEntry[] => {
      const review = fileReviewControl(scope, context, item);
      if (change.scope === 'untracked') {
        const text = textOf(change.path);
        if (text === undefined) return [];
        const current = untracked.contents.has(change.path);
        return [
          {
            ...fileEntry(
              changeId(change),
              item.path,
              text,
              notes.get(item.path) ?? 'untracked',
            ),
            ...(current ? { review } : {}),
          },
        ];
      }
      if (change.scope === 'unmerged' || !change.supported) return [];
      const content = focusedDiff(patchOf(change), focus?.[item.path]);
      const entry = content ? diffEntry(change, content) : null;
      const note = notes.get(item.path);
      const current = livePatch(change) !== undefined;
      return entry
        ? [
            {
              ...entry,
              ...(note ? { note } : {}),
              ...(current ? { review, discardScope: change.scope } : {}),
            },
          ]
        : [];
    }),
  );
  const renderedPaths = new Set(entries.map((entry) => entry.path));
  const paneFile =
    interaction.toolbarTarget !== undefined &&
    /^(file|change|branch):/.test(interaction.entry);
  const omittedFile =
    paneFile && entries.length === 0 && items.length === 1
      ? unrenderable[0]?.item
      : undefined;
  const documentHeader =
    header || loading || failed || unrenderable.length > 0
      ? (controls: CodeHeaderControls) => (
          <>
            {header?.({
              ...controls,
              open: (path) => {
                setPendingOmittedPath(undefined);
                if (!renderedPaths.has(path)) {
                  setPendingOmittedPath(path);
                } else controls.open(path);
              },
            })}
            {failed && (
              <ChangesFailure
                column={column}
                retry={() => {
                  diffs.retry();
                  untracked.retry();
                }}
              />
            )}
            {unrenderable.length > 0 && (
              <OmittedChanges
                changes={unrenderable}
                column={column}
                onTarget={(path, target) => {
                  if (target) {
                    focusOmitted(path, target);
                  }
                }}
                renderedPaths={renderedPaths}
                scope={scope}
                context={context}
                paneFile={Boolean(omittedFile)}
              />
            )}
          </>
        )
      : undefined;

  if (quiet && entries.length === 0 && (diffs.pending || untracked.pending))
    return <ReservedCode count={items.length} />;
  return (
    <CodeDocument
      fullHeight={fullHeight}
      emptyActions={
        omittedFile ? (
          <OmittedActions
            scope={scope}
            context={context}
            item={omittedFile}
            active={interaction.active}
          >
            {headerActions}
          </OmittedActions>
        ) : undefined
      }
      scope={scope}
      context={context}
      interaction={interaction}
      entries={entries}
      column={column}
      {...(footer ? { footer } : {})}
      {...(documentHeader ? { header: documentHeader } : {})}
      {...(headerActions ? { headerActions } : {})}
      {...(headerLeading ? { headerLeading } : {})}
      {...(toolbar ? { toolbar } : {})}
    />
  );
}

function sameTexts(
  kept: ReadonlyMap<string, string>,
  next: ReadonlyMap<string, string>,
) {
  return (
    kept.size === next.size &&
    [...next].every(([path, text]) => kept.get(path) === text)
  );
}

const focusedPatches = new WeakMap<object, Map<string, DiffContent>>();

function focusedDiff(
  content: DiffContent | undefined,
  spans: readonly LineSpan[] | undefined,
): DiffContent | undefined {
  if (!content || !spans?.length || content.kind !== 'text') return content;
  const key = spans
    .map((span) => `${span.startLine}-${span.endLine}`)
    .join(',');
  let cached = focusedPatches.get(content);
  const hit = cached?.get(key);
  if (hit) return hit;
  const patch = focusPatch(content.patch, spans);
  const next = patch ? { ...content, patch } : content;
  cached ??= new Map();
  cached.set(key, next);
  focusedPatches.set(content, cached);
  return next;
}

function ChangesFailure({
  column,
  retry,
}: {
  column: boolean;
  retry: () => void;
}) {
  return (
    <section
      role="alert"
      className={cn(
        'mt-3 flex items-center gap-3 rounded-lg border bg-muted/40 px-4 py-3 text-xs text-muted-foreground',
        !column && 'mx-4',
      )}
    >
      <span>The changes in this document could not be read.</span>
      <Button size="xs" variant="outline" onClick={retry}>
        Try again
      </Button>
    </section>
  );
}

function OmittedChanges({
  changes,
  column,
  onTarget,
  renderedPaths,
  scope,
  context,
  paneFile,
}: {
  paneFile: boolean;
  column: boolean;
  onTarget: (path: string, target: HTMLLIElement | null) => void;
  changes: ReadonlyArray<{
    item: ReviewChangeItem;
    reasons: readonly string[];
    current: boolean;
  }>;
  renderedPaths: ReadonlySet<string>;
  scope: ReviewScope;
  context: ConnectionContext;
}) {
  return (
    <section
      className={cn(
        'mt-3 rounded-lg border bg-muted/40 px-4 py-3',
        !column && 'mx-4',
      )}
    >
      <p className="text-xs font-medium">Non-text content</p>
      <ul className="mt-2 flex flex-col gap-2 text-xs text-muted-foreground">
        {changes.map(({ item, reasons, current }) => (
          <li
            key={item.path}
            aria-label={`${item.path}: ${omittedReasonText(reasons)}`}
            tabIndex={-1}
            ref={(target) => onTarget(item.path, target)}
            className="flex min-w-0 scroll-mt-3 flex-wrap items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <TruncatedText className="min-w-0 basis-full" text={item.path} />
            {isImagePath(item.path) && (
              <>
                <span>Current worktree image</span>
                <ImagePreview
                  scope={scope}
                  path={item.path}
                  connection={context.connection}
                />
              </>
            )}
            <Badge
              variant="outline"
              className="h-auto max-w-full text-left whitespace-normal"
            >
              {omittedReasonText(reasons)}
            </Badge>
            {!paneFile && current && !renderedPaths.has(item.path) && (
              <ReviewedControl
                scope={scope}
                context={context}
                path={item.path}
                fingerprint={item.fingerprint}
                status={item.reviewStatus}
                compact={Boolean(item.fingerprint)}
              />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function OmittedActions({
  scope,
  context,
  item,
  active,
  children,
}: {
  scope: ReviewScope;
  context: ConnectionContext;
  item: ReviewChangeItem;
  active: boolean;
  children: ReactNode;
}) {
  const review = useToggleReviewed(scope, context, (notice) =>
    toast.add(notice),
  );
  const target = fileReviewControl(scope, context, item);
  const hotkeysEnabled = useHotkeysEnabled();
  const toggle = () => review.toggle(target);
  useHotkey(SHORTCUTS.toggleReviewed, toggle, {
    enabled: hotkeysEnabled && active,
    ignoreInputs: true,
  });
  return (
    <>
      <BarAction
        label="Reviewed"
        variant="outline"
        icon={target.reviewed ? CheckIcon : SquareIcon}
        shortcut={SHORTCUTS.toggleReviewed}
        description={review.writeBlock}
        disabled={Boolean(review.writeBlock) || !target.fingerprint}
        pressed={target.reviewed}
        onClick={toggle}
      />
      {children}
    </>
  );
}
