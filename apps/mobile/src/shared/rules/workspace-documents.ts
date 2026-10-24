import { shortOid } from '@porcelain/client/history/rules';
import * as Schema from 'effect/Schema';
import { reviewComparisonSchema } from './review-comparison';

const parentSchema = Schema.Int.check(Schema.isGreaterThanOrEqualTo(1));
export const workspaceDocumentSchema = Schema.Union([
  Schema.Struct({ kind: Schema.Literal('file'), path: Schema.String }),
  Schema.Struct({
    kind: Schema.Literal('review-file'),
    path: Schema.String,
    comparison: reviewComparisonSchema,
  }),
  Schema.Struct({
    kind: Schema.Literal('commit'),
    oid: Schema.String,
    parent: parentSchema,
  }),
  Schema.Struct({
    kind: Schema.Literal('diff'),
    oid: Schema.String,
    parent: parentSchema,
    path: Schema.String,
  }),
]);

export type WorkspaceDocument = typeof workspaceDocumentSchema.Type;

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
    case 'review-file': {
      const comparison =
        document.comparison.kind === 'worktree'
          ? ['worktree']
          : ['branch', document.comparison.base ?? null];
      const comparisonLabel =
        document.comparison.kind === 'worktree'
          ? 'Uncommitted'
          : `Branch · ${document.comparison.base ?? 'Default base'}`;
      return {
        ...document,
        key: JSON.stringify([document.kind, comparison, document.path]),
        title: document.path.split('/').at(-1) ?? document.path,
        label: `${document.path} · ${comparisonLabel}`,
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
    case 'review-file':
      return 'review';
    case 'commit':
    case 'diff':
      return 'history';
  }
}
