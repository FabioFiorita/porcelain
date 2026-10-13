import { shortOid } from '@porcelain/client/history/rules';
import type { ReviewComparison } from '../../reviews';

export type WorkspaceDocument =
  | { readonly kind: 'file'; readonly path: string }
  | { readonly kind: 'review-overview'; readonly comparison: ReviewComparison }
  | {
      readonly kind: 'review-file';
      readonly path: string;
      readonly comparison: ReviewComparison;
    }
  | { readonly kind: 'commit'; readonly oid: string; readonly parent: number }
  | {
      readonly kind: 'diff';
      readonly oid: string;
      readonly parent: number;
      readonly path: string;
    };

export type WorkspaceTab = WorkspaceDocument & {
  readonly key: string;
  readonly title: string;
  readonly label: string;
  readonly closable: true;
};

export type InspectorMode = 'files' | 'review' | 'history';

export function documentTab(document: WorkspaceDocument): WorkspaceTab {
  switch (document.kind) {
    case 'file':
      return {
        ...document,
        key: JSON.stringify(['file', document.path]),
        title: document.path.split('/').at(-1) ?? document.path,
        label: document.path,
        closable: true,
      };
    case 'review-overview':
    case 'review-file': {
      const comparison =
        document.comparison.kind === 'worktree'
          ? ['worktree']
          : ['branch', document.comparison.base ?? null];
      const comparisonLabel =
        document.comparison.kind === 'worktree'
          ? 'Uncommitted'
          : `Branch · ${document.comparison.base ?? 'Default base'}`;
      const path = document.kind === 'review-file' ? document.path : undefined;
      return {
        ...document,
        key: JSON.stringify([document.kind, comparison, path ?? null]),
        title: path ? (path.split('/').at(-1) ?? path) : 'Review',
        label: `${path ?? 'Review overview'} · ${comparisonLabel}`,
        closable: true,
      };
    }
    case 'commit':
      return {
        ...document,
        key: JSON.stringify(['commit', document.oid]),
        title: shortOid(document.oid),
        label: `Commit ${shortOid(document.oid)} · Parent ${document.parent}`,
        closable: true,
      };
    case 'diff':
      return {
        ...document,
        key: JSON.stringify([
          'diff',
          document.oid,
          document.parent,
          document.path,
        ]),
        title: document.path.split('/').at(-1) ?? document.path,
        label: `${document.path} · ${shortOid(document.oid)} · Parent ${document.parent}`,
        closable: true,
      };
  }
}

export function documentMode(document: WorkspaceDocument): InspectorMode {
  switch (document.kind) {
    case 'file':
      return 'files';
    case 'review-overview':
    case 'review-file':
      return 'review';
    case 'commit':
    case 'diff':
      return 'history';
  }
}
