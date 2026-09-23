import type { GitActionScope } from '@porcelain/git-actions/models';
import type { GitBranchReaderPort } from '@porcelain/git-actions/ports';
import { RequestGitSession } from '@porcelain/git/inspection';
import type { GitActionWriterFactory } from '@porcelain/git/actions';
import type { GitSession } from '@porcelain/git/inspection';

type Checkout = Parameters<GitActionWriterFactory>[0];

export class GitBranchReaderAdapter implements GitBranchReaderPort {
  private readonly resolveCheckout: (
    scope: GitActionScope,
    session: GitSession,
    signal: AbortSignal,
  ) => Promise<Checkout>;
  private readonly git: GitActionWriterFactory;

  constructor(
    resolveCheckout: (
      scope: GitActionScope,
      session: GitSession,
      signal: AbortSignal,
    ) => Promise<Checkout>,
    git: GitActionWriterFactory,
  ) {
    this.resolveCheckout = resolveCheckout;
    this.git = git;
  }

  async read(scope: GitActionScope, signal: AbortSignal) {
    const session = new RequestGitSession();
    const checkout = await this.resolveCheckout(scope, session, signal);
    return this.git(checkout).listBranches?.(signal);
  }
}
