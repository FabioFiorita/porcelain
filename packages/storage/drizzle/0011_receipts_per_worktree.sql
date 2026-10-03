-- A Git action receipt belongs to its worktree: collecting the worktree
-- removes it through a foreign key, as it already does for review data.
--
-- The worktree id was only inside the stored receipt, so it is copied into a
-- column. A receipt whose worktree has no presence row yet is not dropped:
-- its worktree is seeded into worktree_presence under the receipt's project
-- and follows the same observed-absence rule as every other worktree.
-- SQLite cannot add a foreign key to an existing table, so the table is
-- rebuilt, with foreign key enforcement off and a foreign_key_check before
-- commit as for every migration.
INSERT OR IGNORE INTO `worktree_presence` (`worktree_id`, `project_id`, `missing_since`)
SELECT DISTINCT json_extract(`value`, '$.worktreeId'), `project_id`, NULL
FROM `git_action_receipts`
WHERE json_type(`value`, '$.worktreeId') = 'text';
--> statement-breakpoint
CREATE TABLE `__new_git_action_receipts` (
	`request_id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`worktree_id` text NOT NULL,
	`value` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `inventory_projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`worktree_id`) REFERENCES `worktree_presence`(`worktree_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_git_action_receipts` ("request_id", "project_id", "worktree_id", "value")
SELECT "request_id", "project_id", json_extract("value", '$.worktreeId'), "value" FROM `git_action_receipts`
WHERE json_type("value", '$.worktreeId') = 'text';
--> statement-breakpoint
DROP TABLE `git_action_receipts`;
--> statement-breakpoint
ALTER TABLE `__new_git_action_receipts` RENAME TO `git_action_receipts`;
--> statement-breakpoint
CREATE INDEX `git_action_receipts_project` ON `git_action_receipts` (`project_id`);
--> statement-breakpoint
CREATE INDEX `git_action_receipts_worktree` ON `git_action_receipts` (`worktree_id`);
