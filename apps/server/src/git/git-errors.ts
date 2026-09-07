export class GitCommandError extends Error {
  override readonly name = 'GitCommandError';
  readonly checkout: string;
  readonly args: readonly string[];

  constructor(checkout: string, args: readonly string[], cause: unknown) {
    super('Git command failed', { cause });
    this.checkout = checkout;
    this.args = [...args];
  }
}

export class UnsupportedFilesystemIdentityError extends Error {
  override readonly name = 'UnsupportedFilesystemIdentityError';
  constructor() {
    super(
      'Filesystem birth time is required for conservative identity matching',
    );
  }
}

export class UnsupportedRepositoryError extends Error {
  override readonly name = 'UnsupportedRepositoryError';
  constructor() {
    super('Bare repositories are not supported');
  }
}

export class InvalidWorktreeInventoryError extends Error {
  override readonly name = 'InvalidWorktreeInventoryError';
}

export class RepositoryIdentityMismatchError extends Error {
  override readonly name = 'RepositoryIdentityMismatchError';
  constructor() {
    super('Checkout belongs to another repository');
  }
}
