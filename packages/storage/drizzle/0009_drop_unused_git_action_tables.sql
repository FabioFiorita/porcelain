-- Git actions keep only their receipts; nothing reads or writes blocks or
-- preparations any more.
DROP TABLE `git_action_blocks`;
--> statement-breakpoint
DROP TABLE `git_action_preparations`;
