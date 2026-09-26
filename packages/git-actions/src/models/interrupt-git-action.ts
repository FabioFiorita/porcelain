import type { GitActionReceiptView } from './git-action-receipt-view.ts';

export type InterruptGitActionInput = { requestId: string };

export type InterruptGitActionResult = GitActionReceiptView;
