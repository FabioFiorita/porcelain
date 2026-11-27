import type { ReactNode } from 'react';
import type { CodeHeaderControls } from './code-document';
import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { usePullRequestCheckout } from '../queries/pull-request';

import {
  remoteConnectionStatus,
  useConnectedContext,
  useRemoteConnections,
} from '@/features/access/index';
import { TruncatedText } from '@/shared/views/truncated-text';
import { FileIcon, HistoryIcon } from 'lucide-react';
import { BarAction } from '@/shared/workspace/bar-action';
import { Button } from '@/components/ui/button';

import {
  CommitGraph,
  FileTimeline,
  RecentHistory,
} from '@/features/history/index';
import { DiscardButton } from '@/features/git-actions/index';
import { useChanges } from '@/features/changes/index';

import { usePrefetchReviewed, useReviewChangeItems } from '../queries/reviewed';
import {
  type DocumentInteraction,
  type DocumentRef,
  entryKey,
  type OpenDocument,
  type DocumentFileTarget,
} from '../rules/documents';

import { isSpecPath } from '@porcelain/client/changes/rules';
import type { ReviewScope } from '@porcelain/client/changes/rules';
import {
  BranchDocument,
  BranchFileDocument,
  type DocumentHeading,
} from './branch-document';
import { CommitDocument } from './commit-document';
import { DocumentToolbar } from './document-toolbar';
import { ChangeTable } from './change-table';

import { FileDocument } from './file-document';
import { ReviewCodeDocument } from './review-code-document';
import { ReadMoreFiles } from './read-more-files';
import { DIFF_WINDOW_FILES } from '@/config/limits';
import { useAtom } from '@effect/atom-react';
import { diffFilesShown } from '../store';
import { useHeldWhileHidden } from '@/shared/hooks/use-held-while-hidden';
import { MarkAllReviewed } from './reviewed-control';
import { formatForDisplay } from '@tanstack/react-hotkeys';
import { Kbd } from '@/components/ui/kbd';
import { SHORTCUTS } from '@/shared/workspace/shortcuts';
import { StateNotice } from '@/shared/views/state-notice';
import { PullRequestDocument } from './pull-request-document';
import type { ComponentType } from 'react';

import { type ConnectionContext } from '@/shared/workspace/connection';
import { counted, shownChangesText } from '@porcelain/client/changes/rules';

export type WalkthroughCodeProps = DocumentProps & {
  document: Extract<DocumentRef, { kind: 'walkthrough-step' }>;
};

export type DocumentProps = {
  base: string | undefined;
  scope: ReviewScope;
  context: ConnectionContext;
  interaction: DocumentInteraction;
  onOpen: OpenDocument;
  sideLabel: string;
  onBrowse: (
    surface: 'changes' | 'files' | 'history',
    trigger: HTMLElement,
  ) => void;
};

export function DocumentView({
  scope,
  context,
  document,
  onOpen,
  onBrowse,
  sideLabel,
  active = false,
  hidden = false,
  base,
  toolbarTarget,
  review: Review,
  walkthroughCode: WalkthroughCode,
  fileTarget,
}: {
  walkthroughCode?: ComponentType<WalkthroughCodeProps> | undefined;
  scope: ReviewScope;
  context: ConnectionContext;
  toolbarTarget?: HTMLElement | null | undefined;
  onOpen: OpenDocument;
  sideLabel: string;
  onBrowse: DocumentProps['onBrowse'];
  active?: boolean;
  hidden?: boolean;
  fileTarget?: DocumentFileTarget | undefined;
  base?: string | undefined;
} & (
  | {
      document: Exclude<DocumentRef, { kind: 'review' }>;
      review?: never;
    }
  | { document: DocumentRef; review: ComponentType<DocumentProps> }
)) {
  const props = {
    base,
    scope,
    context,
    onOpen,
    onBrowse,
    sideLabel,
    interaction: {
      toolbarTarget,
      active,
      worktreeId: scope.worktreeId,
      entry: entryKey(document),
      fileTarget,
      hidden,
    },
  };
  switch (document.kind) {
    case 'review':
      return Review ? <Review {...props} /> : null;
    case 'all-changes':
      return <WindowedChangesDocument {...props} />;
    case 'specs':
      return <PlainChangesDocument {...props} specsOnly />;
    case 'change':
      return <ChangeDocument {...props} path={document.path} />;
    case 'file':
      return <FileDocument {...props} path={document.path} />;
    case 'commit':
      return <CommitDocument {...props} oid={document.oid} />;
    case 'branch':
      return <BranchDocument {...props} />;
    case 'branch-file':
      return <BranchFileDocument {...props} path={document.path} />;
    case 'walkthrough-step':
      return WalkthroughCode ? (
        <WalkthroughCode {...props} document={document} />
      ) : null;
    case 'timeline':
      return <TimelineDocument {...props} path={document.path} />;
    case 'graph':
      return <GraphDocument {...props} />;
    case 'pull-request':
      return (
        <ScopedPullRequestDocument
          document={document}
          context={context}
          toolbarTarget={toolbarTarget}
        />
      );
  }
}

function ScopedPullRequestDocument({
  document,
  context,
  toolbarTarget,
}: {
  document: Extract<DocumentRef, { kind: 'pull-request' }>;
  context: ConnectionContext;
  toolbarTarget: HTMLElement | null | undefined;
}) {
  const local = useConnectedContext();
  const remotes = useRemoteConnections();
  const environmentId =
    document.environmentId ?? context.connection.environmentId;
  const remote = remotes.find(
    (entry) => entry.connection.environmentId === environmentId,
  );
  const source =
    environmentId === local.connection.environmentId
      ? local
      : remote && {
          connection: remote.connection,
          remoteStatus: remoteConnectionStatus(environmentId),
        };
  if (!source)
    return (
      <StateNotice message="Pair this pull request's computer in Settings to read it." />
    );
  return (
    <PullRequestSourceDocument
      document={document}
      context={source}
      localEnvironmentId={local.connection.environmentId}
      toolbarTarget={toolbarTarget}
    />
  );
}

function PullRequestSourceDocument({
  document,
  context,
  localEnvironmentId,
  toolbarTarget,
}: {
  document: Extract<DocumentRef, { kind: 'pull-request' }>;
  context: ConnectionContext;
  localEnvironmentId: string;
  toolbarTarget: HTMLElement | null | undefined;
}) {
  const navigate = useNavigate();
  const checkout = usePullRequestCheckout(
    context.connection,
    document.projectId,
    document.number,
  );
  const openSource = (entry: DocumentRef) => {
    if (!checkout) {
      void navigate({ to: '/' });
      return;
    }
    const params = checkout;
    const search = { entry: entryKey(entry) };
    void navigate(
      context.connection.environmentId === localEnvironmentId
        ? { to: '/$projectId/$worktreeId', params, search }
        : {
            to: '/remotes/$environmentId/$projectId/$worktreeId',
            params: {
              ...params,
              environmentId: context.connection.environmentId,
            },
            search,
          },
    );
  };
  return (
    <PullRequestDocument
      projectId={document.projectId}
      number={document.number}
      context={context}
      toolbarTarget={toolbarTarget}
      onBack={() => openSource({ kind: 'review' })}
      onFile={
        checkout ? (path) => openSource({ kind: 'file', path }) : undefined
      }
      checkout={checkout}
      onOpen={checkout ? openSource : undefined}
    />
  );
}

function GraphDocument({ scope, context, onOpen, sideLabel }: DocumentProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <CommitGraph
        scope={scope}
        connection={context.connection}
        sideLabel={sideLabel}
        onSelect={(oid, toSide) =>
          onOpen(
            { kind: 'commit', oid },
            {
              toSide: toSide === true,
            },
          )
        }
      />
    </div>
  );
}

function TimelineDocument({
  scope,
  context,
  path,
  onOpen,
  sideLabel,
}: DocumentProps & { path: string }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <DocumentToolbar
        titleLabel={`Timeline of ${path}`}
        title={
          <span className="flex min-w-0 items-center gap-1.5">
            <HistoryIcon className="size-4 shrink-0" />
            <TruncatedText text={path} />
          </span>
        }
      />
      <FileTimeline
        scope={scope}
        connection={context.connection}
        path={path}
        sideLabel={sideLabel}
        onSelect={(commit, toSide) =>
          onOpen(
            { kind: 'commit', oid: commit.oid },
            { path: commit.path, toSide: toSide === true },
          )
        }
      />
    </div>
  );
}

function changesLabel(specsOnly: boolean, count: number, omitted?: number) {
  return (
    (specsOnly ? undefined : shownChangesText(count, omitted)) ??
    counted(count, specsOnly ? 'uncommitted spec change' : 'uncommitted change')
  );
}

function WindowedChangesDocument(props: DocumentProps) {
  const { connection } = props.context;
  const [shown, setShown] = useAtom(
    diffFilesShown(
      JSON.stringify([
        connection.environmentId,
        props.scope.projectId,
        props.scope.worktreeId,
        'all-changes',
      ]),
    ),
  );
  return (
    <PlainChangesDocument
      {...props}
      limit={shown}
      onReadMore={() => setShown(shown + DIFF_WINDOW_FILES)}
    />
  );
}

export function PlainChangesDocument({
  scope,
  context,
  interaction,
  onBrowse,
  onOpen,
  sideLabel,
  specsOnly = false,
  only,
  heading,
  fullHeight,
  limit,
  onReadMore,
}: DocumentProps & {
  specsOnly?: boolean;
  only?: readonly string[] | undefined;
  heading?: DocumentHeading | undefined;
  fullHeight?: boolean | undefined;
  limit?: number | undefined;
  onReadMore?: (() => void) | undefined;
}) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const { connection } = context;
  usePrefetchReviewed(scope, context);
  const list = useHeldWhileHidden(
    useChanges(scope, connection),
    interaction.hidden === true,
  );
  const allChanges = useReviewChangeItems(scope, context, list);
  const inScope = (path: string) =>
    only ? only.includes(path) : !specsOnly || isSpecPath(path);
  const changes = allChanges.filter((item) => inScope(item.path));
  const omitted =
    changes.length === allChanges.length ? list.omittedChanges : undefined;
  const shown = limit === undefined ? changes : changes.slice(0, limit);
  const singleHeader = heading !== undefined;
  if (!specsOnly && changes.length === 0 && actionsOpen) setActionsOpen(false);
  if (only && changes.length === 0)
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {heading && (
          <DocumentToolbar
            inline
            title={heading.title}
            titleLabel={heading.titleLabel}
          >
            {heading.after}
          </DocumentToolbar>
        )}
        <p className="p-5 text-prose text-foreground-2">
          Nothing uncommitted in this step.
        </p>
      </div>
    );
  if (!specsOnly && changes.length === 0)
    return (
      <NoChanges
        scope={scope}
        context={context}
        onBrowse={onBrowse}
        onOpen={onOpen}
        sideLabel={sideLabel}
      />
    );
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ReviewCodeDocument
        fullHeight={fullHeight}
        scope={scope}
        context={context}
        interaction={interaction}
        windowLimit={limit}
        {...(specsOnly || only || limit !== undefined
          ? { paths: shown.map((item) => item.path) }
          : {})}
        column={!singleHeader}
        {...(singleHeader
          ? {
              toolbar: (collapse: ReactNode) => (
                <DocumentToolbar
                  inline
                  {...(heading
                    ? { title: heading.title, titleLabel: heading.titleLabel }
                    : { title: 'All changes' })}
                  subtitle={changesLabel(specsOnly, changes.length, omitted)}
                >
                  {collapse}
                  {heading?.after}
                </DocumentToolbar>
              ),
            }
          : {
              header: (controls: CodeHeaderControls) => (
                <div className="pt-6">
                  <ChangeTable
                    scope={scope}
                    context={context}
                    label={changesLabel(specsOnly, changes.length, omitted)}
                    items={changes}
                    rows={shown.length}
                    controls={controls}
                    actionsOpen={actionsOpen}
                    onActionsOpenChange={setActionsOpen}
                    actions={
                      <MarkAllReviewed
                        scope={scope}
                        context={context}
                        entries={changes}
                      />
                    }
                  />
                </div>
              ),
            })}
      />
      {onReadMore && (
        <ReadMoreFiles
          more={changes.length - shown.length}
          total={changes.length}
          pending={false}
          onReadMore={onReadMore}
        />
      )}
    </div>
  );
}

export function NoChanges({
  scope,
  context,
  onBrowse,
  onOpen,
  sideLabel,
}: Pick<
  DocumentProps,
  'scope' | 'context' | 'onBrowse' | 'onOpen' | 'sideLabel'
>) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-(--container-commit) px-4 py-6">
        <RecentHistory
          scope={scope}
          connection={context.connection}
          sideLabel={sideLabel}
          onOpenCommit={(oid, toSide) =>
            onOpen({ kind: 'commit', oid }, { toSide: toSide === true })
          }
          onOpenGraph={() => onOpen({ kind: 'graph' })}
          status={
            <div className="flex items-center gap-2 text-caption text-muted-foreground">
              <span>No changes to review.</span>
              <Button
                variant="ghost"
                size="xs"
                onClick={(event) => onBrowse('files', event.currentTarget)}
              >
                Files <Kbd>{formatForDisplay(SHORTCUTS.surfaceFiles)}</Kbd>
              </Button>
            </div>
          }
        />
      </div>
    </div>
  );
}

function ChangeDocument({
  scope,
  context,
  interaction,
  onOpen,
  path,
}: DocumentProps & { path: string }) {
  const { connection } = context;
  usePrefetchReviewed(scope, context);
  const list = useChanges(scope, connection);
  const change = useReviewChangeItems(scope, context, list, [path]).find(
    (entry) => entry.path === path,
  );
  if (!change)
    return <StateNotice message="This change is no longer present." />;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <DiscardButton
        scope={scope}
        context={context}
        path={path}
        variant="quiet"
      >
        {(trigger) => (
          <ReviewCodeDocument
            headerActions={
              <>
                <BarAction
                  label="Timeline"
                  iconOnly
                  icon={HistoryIcon}
                  onClick={() => onOpen({ kind: 'timeline', path })}
                />
              </>
            }
            headerLeading={
              <>
                <Button
                  variant="ghost"
                  size="xs"
                  aria-label="Open file"
                  onClick={() => onOpen({ kind: 'file', path })}
                >
                  <FileIcon />
                  <span className="max-narrow:sr-only">Open file</span>
                </Button>
                {trigger}
              </>
            }
            scope={scope}
            context={context}
            interaction={interaction}
            paths={[path]}
          />
        )}
      </DiscardButton>
    </div>
  );
}
