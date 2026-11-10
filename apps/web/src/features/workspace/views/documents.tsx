import type { ReactNode } from 'react';
import type { CodeHeaderControls } from './code-document';
import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { usePullRequestCheckout } from '../queries/pull-request';

import {
  useConnectedContext,
  useRemoteConnections,
} from '@/features/access/index';
import { TruncatedText } from '@/shared/views/truncated-text';
import { FileIcon, HistoryIcon } from 'lucide-react';
import { BarAction } from '@/shared/workspace/bar-action';
import { Button } from '@/components/ui/button';

import { CommitGraph, FileTimeline } from '@/features/history/index';
import { DiscardButton } from '@/features/git-actions/index';
import { useChanges } from '@/features/changes/index';

import { usePrefetchReviewed, useReviewChangeItems } from '../queries/reviewed';
import type { RevealComment } from '@porcelain/client/reviews/rules';
import {
  type DocumentInteraction,
  type DocumentRef,
  entryKey,
  type OpenDocument,
} from '../rules/documents';

import { isSpecPath } from '@porcelain/client/reviews/rules';
import type { ReviewScope } from '@porcelain/client/reviews/rules';
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
import { MarkAllReviewed } from './reviewed-control';
import { formatForDisplay } from '@tanstack/react-hotkeys';
import { Kbd } from '@/components/ui/kbd';
import { SHORTCUTS } from '@/shared/workspace/shortcuts';
import { StateNotice } from '@/shared/views/state-notice';
import { PullRequestDocument } from './pull-request-document';
import type { ComponentType } from 'react';

import { type ConnectionContext } from '@/shared/workspace/connection';
import type { ChangeScope } from '@/shared/workspace/search';
import { counted } from '@porcelain/client/reviews/rules';

export type StepDocumentProps = DocumentProps & {
  step: number;
  changeScope: ChangeScope;
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
    trigger: HTMLButtonElement,
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
  reveal,
  base,
  toolbarTarget,
  walkthrough: Walkthrough,
  stepDocument: StepDocument,
  changeScope = 'uncommitted',
  singleHeader = false,
}: {
  stepDocument?: ComponentType<StepDocumentProps> | undefined;
  changeScope?: ChangeScope | undefined;
  singleHeader?: boolean | undefined;
  scope: ReviewScope;
  context: ConnectionContext;
  toolbarTarget?: HTMLElement | null | undefined;
  onOpen: OpenDocument;
  sideLabel: string;
  onBrowse: DocumentProps['onBrowse'];
  active?: boolean;
  reveal?: RevealComment | undefined;
  base?: string | undefined;
} & (
  | { document: Exclude<DocumentRef, { kind: 'handoff' }>; walkthrough?: never }
  | { document: DocumentRef; walkthrough: ComponentType<DocumentProps> }
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
      reveal,
      singleHeader,
    },
  };
  switch (document.kind) {
    case 'handoff':
      return Walkthrough ? <Walkthrough {...props} /> : null;
    case 'all-changes':
      return <PlainChangesDocument {...props} />;
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
      return StepDocument ? (
        <StepDocument
          {...props}
          step={document.step}
          changeScope={changeScope}
        />
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
  const connection =
    document.environmentId === undefined
      ? context.connection
      : [local.connection, ...remotes.map((remote) => remote.connection)].find(
          (connection) => connection.environmentId === document.environmentId,
        );
  if (!connection)
    return (
      <StateNotice
        title="Computer not paired"
        description="Pair this pull request's computer in Settings to read it."
      />
    );
  return (
    <PullRequestSourceDocument
      document={document}
      context={{ connection }}
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
    document.reviewId,
  );
  if (!checkout)
    return <StateNotice title="Pull request checkout unavailable" />;
  const openSource = (
    entry: { kind: 'handoff' } | { kind: 'file'; path: string },
  ) => {
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
      reviewId={document.reviewId}
      number={document.number}
      context={context}
      toolbarTarget={toolbarTarget}
      onBack={() => openSource({ kind: 'handoff' })}
      onFile={(path) => openSource({ kind: 'file', path })}
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
          onOpen({ kind: 'commit', oid }, undefined, {
            toSide: toSide === true,
          })
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
        subtitle="Commits that changed this file"
      />
      <FileTimeline
        scope={scope}
        connection={context.connection}
        path={path}
        sideLabel={sideLabel}
        onSelect={(commit, toSide) =>
          onOpen(
            { kind: 'commit', oid: commit.oid },
            {
              kind: 'file',
              filePath: commit.path,
              revision: commit.oid,
              comparison: { kind: 'commit', parent: 1 },
            },
            { toSide: toSide === true },
          )
        }
      />
    </div>
  );
}

function changesLabel(specsOnly: boolean, count: number) {
  return counted(
    count,
    specsOnly ? 'uncommitted spec change' : 'uncommitted change',
  );
}

export function PlainChangesDocument({
  scope,
  context,
  interaction,
  onBrowse,
  specsOnly = false,
  only,
  heading,
}: DocumentProps & {
  specsOnly?: boolean;
  only?: readonly string[] | undefined;
  heading?: DocumentHeading | undefined;
}) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const { connection } = context;
  usePrefetchReviewed(scope, context);
  const list = useChanges(scope, connection);
  const allChanges = useReviewChangeItems(scope, context, list);
  const inScope = (path: string) =>
    only ? only.includes(path) : !specsOnly || isSpecPath(path);
  const changes = allChanges.filter((item) => inScope(item.path));
  const singleHeader = interaction.singleHeader || heading !== undefined;
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
      <div className="mx-auto w-full max-w-xl">
        <StateNotice
          title="No changes to review"
          description={
            <>
              <span className="font-mono text-foreground">
                {list.branch?.name ?? 'This worktree'}
              </span>{' '}
              matches its last commit. Browse files or history from the right.
            </>
          }
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={(event) => onBrowse('files', event.currentTarget)}
          >
            Files <Kbd>{formatForDisplay(SHORTCUTS.surfaceFiles)}</Kbd>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(event) => onBrowse('history', event.currentTarget)}
          >
            History <Kbd>{formatForDisplay(SHORTCUTS.surfaceHistory)}</Kbd>
          </Button>
        </StateNotice>
      </div>
    );
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ReviewCodeDocument
        scope={scope}
        context={context}
        interaction={interaction}
        {...(specsOnly || only
          ? { paths: changes.map((item) => item.path) }
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
                  subtitle={changesLabel(specsOnly, changes.length)}
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
                    label={changesLabel(specsOnly, changes.length)}
                    items={changes}
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
    return (
      <StateNotice
        title="Change no longer present"
        description="Choose a change that is still present in the current review."
      />
    );

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
            {...(interaction.reveal?.compose
              ? { commentRequest: interaction.reveal.nonce }
              : {})}
            headerActions={
              <>
                <BarAction
                  label="Timeline"
                  iconOnly
                  icon={HistoryIcon}
                  onClick={() => onOpen({ kind: 'timeline', path })}
                />
                {interaction.singleHeader && (
                  <>
                    <BarAction
                      label="Open file"
                      iconOnly
                      icon={FileIcon}
                      onClick={() => onOpen({ kind: 'file', path })}
                    />
                    {trigger}
                  </>
                )}
              </>
            }
            headerLeading={
              interaction.singleHeader ? undefined : (
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
              )
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
