import type { ComponentType, ReactNode } from 'react';

import { useState } from 'react';
import { notify } from '@/shared/views/notify';
import { DiscardButton } from '@/features/git-actions/index';
import { ScrollArea } from '@/components/ui/scroll-area';
import { type ChangeScope } from '@/shared/workspace/search';
import { SegmentedTabs } from './segmented-tabs';
import { useChanges } from '@/features/changes/index';
import {
  ReviewedCount,
  SidebarGroup,
  SidebarDocumentRow,
} from './sidebar-section';
import { useToggleReviewed } from '../commands/reviewed';

import { usePrefetchReviewed, useReviewChangeItems } from '../queries/reviewed';
import {
  ALL_CHANGES,
  SPECS,
  entryKey,
  type OpenDocument,
} from '../rules/documents';

import {
  type ChangeList,
  type ReviewChangeItem,
  type ReviewScope,
} from '@porcelain/client/changes/rules';

import { type BranchFileGrouping, BranchIndex } from './branch-index';
import { ChangeRow } from './change-row';
import { useFileComments } from '@/features/comments/index';
import { worktreeChangeMarks } from '@porcelain/client/files/rules';

import { isSpecPath } from '@porcelain/client/changes/rules';
import { useSpecsApart } from '@/features/preferences/index';
import { type ConnectionContext } from '@/shared/workspace/connection';

type WorkspaceChangesProps = {
  scope: ReviewScope;
  context: ConnectionContext;
  activeEntry: string | undefined;
  onOpen: OpenDocument;
  sideLabel: string;
};
const CHANGE_SCOPES: readonly { value: ChangeScope; label: string }[] = [
  { value: 'uncommitted', label: 'Uncommitted' },
  { value: 'branch', label: 'Branch' },
];

type ScopeProps = {
  changeScope: ChangeScope;
  base: string | undefined;
  onChangeScope: (scope: ChangeScope) => void;
  onBase: (base: string | undefined) => void;
};

export type ReviewIndexProps = WorkspaceChangesProps & ScopeProps;

export type UncommittedFileGrouping = ComponentType<{
  base: string | undefined;
  scope: ReviewScope;
  context: ConnectionContext;
  paths: readonly string[];
  row: (path: string) => ReactNode;
  activeEntry: string | undefined;
  onOpen: OpenDocument;
}>;

export type ChangeGrouping = {
  branch: BranchFileGrouping;
  uncommitted: UncommittedFileGrouping;
};

export function ReviewIndex({
  grouping,
  scope,
  context,
  activeEntry,
  onOpen,
  sideLabel,
  changeScope,
  base,
  onChangeScope,
  onBase,
}: ReviewIndexProps & { grouping?: ChangeGrouping }) {
  const { connection } = context;
  usePrefetchReviewed(scope, context);
  const list = useChanges(scope, connection);
  const changes = useReviewChangeItems(scope, context, list);

  const branch = changeScope === 'branch';
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SegmentedTabs
        label="Changes to review"
        className="px-2.5 pt-3"
        value={changeScope}
        onValue={onChangeScope}
        options={CHANGE_SCOPES}
      />
      {branch && (
        <BranchIndex
          scope={scope}
          context={context}
          base={base}
          activeEntry={activeEntry}
          onOpen={onOpen}
          sideLabel={sideLabel}
          onBase={onBase}
          grouping={grouping?.branch}
        />
      )}
      {!branch && (
        <LayersView
          scope={scope}
          context={context}
          activeEntry={activeEntry}
          onOpen={onOpen}
          sideLabel={sideLabel}
          list={list}
          changes={changes}
          grouping={grouping?.uncommitted}
          base={base}
        />
      )}
    </div>
  );
}

function LayersView({
  scope,
  context,
  activeEntry,
  onOpen,
  sideLabel,
  list,
  changes,
  grouping: Grouping,
  base,
}: WorkspaceChangesProps & {
  base: string | undefined;
  grouping: UncommittedFileGrouping | undefined;
  list: ChangeList;
  changes: readonly ReviewChangeItem[];
}) {
  const specsApart = useSpecsApart(context.connection);
  const [groups, setGroups] = useState({ changes: true, specs: false });
  const paths = list.changes.map((entry) => entry.path);
  const mainPaths = specsApart
    ? paths.filter((path) => !isSpecPath(path))
    : paths;
  const specPaths = specsApart ? paths.filter(isSpecPath) : [];
  const changeByPath = new Map(changes.map((item) => [item.path, item]));
  const changeMarks = worktreeChangeMarks(list.changes);
  const reviewed = useToggleReviewed(scope, context, (notice) =>
    notify(notice),
  );
  const comments = useFileComments({ scope, context });
  const [discard, setDiscard] = useState<{
    path: string;
    nonce: number;
  } | null>(null);
  const navigation = () => {
    if (Grouping)
      return (
        <Grouping
          base={base}
          scope={scope}
          context={context}
          paths={paths}
          row={renderChange}
          activeEntry={activeEntry}
          onOpen={onOpen}
        />
      );
    return (
      <SidebarDocumentRow
        label="All changes"
        active={activeEntry === entryKey(ALL_CHANGES)}
        onOpen={() => onOpen(ALL_CHANGES)}
      >
        All changes
      </SidebarDocumentRow>
    );
  };
  const renderChange = (path: string) => (
    <ChangeRow
      key={path}
      path={path}
      document={{ kind: 'change', path }}
      note={undefined}
      changeStatus={changeMarks.files.get(path)}
      scopes={[
        ...new Set(
          list.changes
            .find((entry) => entry.path === path)
            ?.comparisons.map((change) => change.scope),
        ),
      ]}
      reviewStatus={changeByPath.get(path)?.reviewStatus}
      active={activeEntry === entryKey({ kind: 'change', path })}
      onOpen={onOpen}
      sideLabel={sideLabel}
      writeBlock={reviewed.writeBlock}
      commentCount={comments.counts.get(path)}
      onComment={() => comments.comment(path)}
      canReview={
        changeByPath.get(path)?.fingerprint !== null &&
        changeByPath.get(path)?.fingerprint !== undefined
      }
      onReview={() =>
        reviewed.toggle({
          path,
          reviewed: changeByPath.get(path)?.reviewStatus === 'reviewed',
          fingerprint: changeByPath.get(path)?.fingerprint,
        })
      }
      onDiscard={() =>
        setDiscard((current) => ({
          path,
          nonce: (current?.nonce ?? 0) + 1,
        }))
      }
    />
  );
  return (
    <ScrollArea className="h-0 min-h-0 flex-1">
      <div className="px-2.5 pt-2 pb-3">
        {paths.length > 0 && (
          <ReviewedCount
            reviewed={
              paths.filter(
                (path) => changeByPath.get(path)?.reviewStatus === 'reviewed',
              ).length
            }
            total={paths.length}
          />
        )}
        {comments.summary}
        {comments.dialogs}
        {navigation()}
        {!Grouping && paths.length === 0 && (
          <p className="px-2 py-1 text-caption text-muted-foreground">
            No changes
          </p>
        )}
        {!Grouping && mainPaths.length > 0 && (
          <SidebarGroup
            name="Changed files"
            count={mainPaths.length}
            expanded={groups.changes}
            onExpanded={(changes) =>
              setGroups((current) => ({ ...current, changes }))
            }
            onAll={(expanded) =>
              setGroups({ changes: expanded, specs: expanded })
            }
          >
            {mainPaths.map(renderChange)}
          </SidebarGroup>
        )}
        {!Grouping && specPaths.length > 0 && (
          <SidebarGroup
            name="Specs"
            count={specPaths.length}
            expanded={groups.specs}
            onExpanded={(specs) =>
              setGroups((current) => ({ ...current, specs }))
            }
            onAll={(expanded) =>
              setGroups({ changes: expanded, specs: expanded })
            }
          >
            <SidebarDocumentRow
              label="Open all specs"
              active={activeEntry === 'specs'}
              onOpen={() => onOpen(SPECS)}
            >
              Open all specs
            </SidebarDocumentRow>
            {specPaths.map(renderChange)}
          </SidebarGroup>
        )}
        {discard && (
          <DiscardButton
            scope={scope}
            context={context}
            path={discard.path}
            signal={discard.nonce}
            hiddenTrigger
          />
        )}
      </div>
    </ScrollArea>
  );
}
