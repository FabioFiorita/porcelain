import { COMMENT_BODY_LENGTH } from '@porcelain/contracts/shared';
import { useAtom, useAtomMount } from '@effect/atom-react';
import { useId } from 'react';
import { type Atom } from 'effect/reactivity';
import {
  commentCommands,
  observeCommentVisibility,
  commentWriteBinding,
} from '@porcelain/client/reviews';
import type { Workspace } from '../../projects';

export function useCommentCommands(
  workspace: Pick<Workspace, 'connection' | 'scope'>,
) {
  const owner = useId();
  return commentCommands(
    {
      connection: workspace.connection,
      scope: workspace.scope,
    },
    owner,
  );
}

export function useCommentWrite<Input, A, E>(
  command: Atom.AtomResultFn<Input, A, E>,
) {
  return commentWriteBinding(useAtom(command, { mode: 'promiseExit' }));
}

export const commentBodyLimit = COMMENT_BODY_LENGTH;

export function useVisibleComments(
  workspace: Pick<Workspace, 'connection' | 'scope'>,
  all: boolean,
) {
  const owner = useId();
  useAtomMount(
    observeCommentVisibility({
      ...workspace,
      owner,
      filter: all ? 'all' : undefined,
    }),
  );
}
