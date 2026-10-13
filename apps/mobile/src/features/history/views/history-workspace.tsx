import { useState, type Dispatch, type SetStateAction } from 'react';
import { shortOid } from '@porcelain/client/history/rules';
import { Box } from '../../../components/ui/box';
import { Empty } from '../../../components/ui/empty';
import { DocumentTabs } from '../../../components/ui/document-tabs';
import { WorkspacePanes } from '../../../components/ui/workspace-panes';
import {
  emptyDocuments,
  openDocument,
  activateDocument,
  type DocumentTabsState,
} from '../../../shared/rules/document-tabs';
import type { Workspace } from '../../projects';
import { HistoryNavigation } from './history-navigation';
import { CommitContent } from './commit-content';
import { DiffContent } from './diff-content';

type HistoryDocument = {
  readonly key: string;
  readonly oid: string;
  readonly parent: number;
  readonly title: string;
  readonly label: string;
  readonly closable: true;
} & (
  | { readonly kind: 'commit' }
  | { readonly kind: 'diff'; readonly path: string }
);

export function HistoryWorkspace({ current }: { current: Workspace }) {
  const [documents, setDocuments] = useState<
    DocumentTabsState<HistoryDocument>
  >(() => emptyDocuments<HistoryDocument>());
  const active = documents.tabs.find((tab) => tab.key === documents.active);
  const open = (document: HistoryDocument) =>
    setDocuments((state) =>
      state.tabs.some((tab) => tab.key === document.key)
        ? activateDocument(state, document.key)
        : openDocument(state, document),
    );
  return (
    <WorkspacePanes
      navigationLabel="History"
      hasSelection={active !== undefined}
      navigation={(showContent) => (
        <HistoryNavigation
          selection={current}
          workspace={current.key}
          selected={active?.oid}
          onOpen={(oid) => {
            open({
              key: JSON.stringify(['commit', oid]),
              kind: 'commit',
              closable: true,
              oid,
              parent: 1,
              title: shortOid(oid),
              label: `Commit ${shortOid(oid)}`,
            });
            showContent();
          }}
        />
      )}
    >
      <Box className="flex-1" surface="background">
        <DocumentTabs documents={documents} onChange={setDocuments} />
        <SelectedHistoryDocument
          active={active}
          current={current}
          setDocuments={setDocuments}
          open={open}
        />
      </Box>
    </WorkspacePanes>
  );
}

function SelectedHistoryDocument({
  active,
  current,
  setDocuments,
  open,
}: {
  active: HistoryDocument | undefined;
  current: Workspace;
  setDocuments: Dispatch<SetStateAction<DocumentTabsState<HistoryDocument>>>;
  open: (document: HistoryDocument) => void;
}) {
  if (!active)
    return (
      <Empty
        title="Select a commit"
        description="Choose a commit from History to see its changes."
        icon="history"
      />
    );
  if (active.kind === 'diff')
    return (
      <DiffContent
        key={active.key}
        selection={current}
        oid={active.oid}
        parent={active.parent}
        path={active.path}
      />
    );
  return (
    <CommitContent
      key={active.key}
      selection={current}
      oid={active.oid}
      parent={active.parent}
      onParentChange={(parent) =>
        setDocuments((state) => ({
          ...state,
          tabs: state.tabs.map((tab) =>
            tab.key === active.key ? { ...tab, parent } : tab,
          ),
        }))
      }
      onOpenFile={(path) =>
        open({
          key: JSON.stringify(['diff', active.oid, active.parent, path]),
          kind: 'diff',
          closable: true,
          oid: active.oid,
          parent: active.parent,
          path,
          title: path.split('/').at(-1) ?? path,
          label: `${path} · ${shortOid(active.oid)} · Parent ${active.parent}`,
        })
      }
    />
  );
}
